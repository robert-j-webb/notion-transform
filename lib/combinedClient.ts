import {
  BlogPost,
  listNotionBlogPosts,
  initializeNotionProperties,
} from "@/lib/notionClient";
import {
  createNewWebflowBlogPost,
  listBlogCategories,
  listStagedWebflowBlogPosts,
  listTeamMembers,
  updateStagedWebflowBlogPost,
} from "@/lib/webflowClient";
import { CollectionItem } from "webflow-api/api";
import { notionPageToHtml } from "./notion-to-html";

export type CombinedBlogPost = { webflowData?: CollectionItem } & BlogPost;

export async function getCombinedBlogPosts(
  databaseId: string
): Promise<CombinedBlogPost[]> {
  const notionPosts = await listNotionBlogPosts(databaseId);
  let stagedWebflowPosts = {};
  try {
    stagedWebflowPosts = await listStagedWebflowBlogPosts();
  } catch (error) {
    console.error("Error listing staged webflow posts:", error);
    stagedWebflowPosts = [];
  }

  if (!stagedWebflowPosts?.items) {
    throw new Error("No staged webflow posts found");
  }
  return notionPosts
    .map((post) => {
      const webflowId = (post.properties["Webflow ID"] as any)?.rich_text?.[0]
        ?.plain_text;
      const webflowData = stagedWebflowPosts.items!.find(
        (item) => item.id === webflowId
      );
      if (webflowData) {
        delete webflowData.fieldData["post-body"];
      }
      return { ...post, webflowData };
    })
    .sort(
      (a, b) =>
        new Date(b.last_edited_time).getTime() -
        new Date(a.last_edited_time).getTime()
    );
}

export async function publishBlogPost({
  notionId,
}: {
  notionId: string;
}) {
  const notionResult = await notionPageToHtml(notionId, { isPublish: true });
  if (notionResult.error) {
    throw new Error(`Failed to fetch Notion content: ${notionResult.error}`);
  }

  const { title, html, page } = notionResult;
  if (!page || !("properties" in page) || !html) {
    throw new Error("Invalid Notion page data");
  }

  const properties = page.properties as Record<string, any>;
  const blogTitle = properties?.Title?.rich_text?.[0]?.plain_text ?? title;
  const notionAuthors = properties?.Authors?.multi_select?.map(
    (author: any) => author.name
  );
  const notionCategory =
    properties?.Team?.select?.name ?? properties?.Category?.select?.name;
  const coverPhotoUrl = properties?.["Cover Photo"]?.files?.[0]?.file?.url;
  const thumbnailUrl = properties?.["Thumbnail"]?.files?.[0]?.file?.url;
  const existingWebflowId =
    properties?.["Webflow ID"]?.rich_text?.[0]?.plain_text;

  let webflowAuthorIds: string[] = [];
  let webflowCategory: CollectionItem | undefined;
  if (
    process.env.WEBFLOW_TEAM_MEMBER_COLLECTION_ID &&
    process.env.WEBFLOW_BLOG_CATEGORY_COLLECTION_ID
  ) {
    const [teamMembers, blogCategories] = await Promise.all([
      listTeamMembers(),
      listBlogCategories(),
    ]);

    webflowAuthorIds = notionAuthors.map((author: string) => {
      const member = teamMembers.items!.find(
        (member: CollectionItem) => member.fieldData.name === author
      );
      if (!member) {
        throw new Error(`Author "${author}" not found in Webflow DB`);
      }
      return member.id;
    });

    webflowCategory = blogCategories.items!.find(
      (category: CollectionItem) =>
        category.fieldData.name?.toLowerCase() === notionCategory?.toLowerCase()
    );
  }
  // The description is usually just the first paragraph.
  const descriptionRegex = /<p>([^<]*)<\/p>/;
  const description = descriptionRegex.exec(html || "")?.[1] || "";

  const slug = createSlug(blogTitle);
  // These fields will need to match whatever you have in the webflow CMS and will
  // change depending on your blog post template.
  const cmsItemData: any = {
    name: blogTitle,
    slug,
    "post-body": html || "",
    "post-decription": description,
  };

  if (coverPhotoUrl) {
    cmsItemData["cover-image"] = coverPhotoUrl;
  }
  if (thumbnailUrl) {
    cmsItemData["thumbnail-image"] = thumbnailUrl;
  }
  if (webflowCategory) {
    cmsItemData.category = webflowCategory.id;
  }
  if (webflowAuthorIds.length > 0) {
    cmsItemData.authors = webflowAuthorIds;
  }

  if (!existingWebflowId) {
    // Post is not yet published, create new item in Webflow
    const result = await createNewWebflowBlogPost(cmsItemData);
    if (!result.id) {
      throw new Error("Failed to create item in Webflow");
    }
    const updateResult = await initializeNotionProperties({
      notionId,
      webflowId: result.id,
    });
    if (!updateResult.id) {
      throw new Error("Failed to update Webflow ID in Notion");
    }
  } else {
    // Update existing webflow item
    const result = await updateStagedWebflowBlogPost(cmsItemData, {
      existingWebflowId,
    });
    if (!result.id) {
      throw new Error("Failed to update live blog post");
    }
  }
}

export function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
