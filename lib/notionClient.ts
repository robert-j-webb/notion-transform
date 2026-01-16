import {
  Client,
  DataSourceObjectResponse,
  ListBlockChildrenResponse,
  PageObjectResponse,
  UpdatePageResponse,
} from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY! });

export async function initializeNotionProperties({
  notionId,
  webflowId,
}: {
  notionId: string;
  webflowId: string;
}): Promise<UpdatePageResponse> {
  return await notion.pages.update({
    page_id: notionId,
    properties: {
      "Webflow ID": { rich_text: [{ text: { content: webflowId } }] },
    },
  });
}

export async function getNotionPage({
  notionPageId,
}: {
  notionPageId: string;
}): Promise<PageObjectResponse> {
  return (await notion.pages.retrieve({
    page_id: notionPageId,
  })) as PageObjectResponse;
}

export async function listBlocksChildren({
  blockId,
  startCursor,
}: {
  blockId: string;
  startCursor: string | undefined;
}): Promise<ListBlockChildrenResponse> {
  return await notion.blocks.children.list({
    block_id: blockId,
    start_cursor: startCursor,
  });
}

export async function listNotionBlogPosts(
  databaseId: string,
): Promise<BlogPost[]> {
  const database = await notion.databases.retrieve({ database_id: databaseId });
  if (!("data_sources" in database)) {
    throw new Error("Database does not have data sources");
  }
  const blogPostsDataSource = database.data_sources.find((source) =>
    source.name.toLowerCase().startsWith("blog posts"),
  )!;
  if (!blogPostsDataSource) {
    throw new Error("Blog posts data source not found");
  }
  const blogPasts = await notion.dataSources.query({
    data_source_id: blogPostsDataSource?.id,
  });
  return blogPasts.results as BlogPost[];
}
export type BlogPost = PageObjectResponse | DataSourceObjectResponse;
