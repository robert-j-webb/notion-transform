import { createHash } from "crypto";
import { WebflowClient } from "webflow-api";
import {
  CollectionItem,
  CollectionItemList,
  CollectionItemListNoPagination,
} from "webflow-api/api";

const client = new WebflowClient({ accessToken: process.env.WEBFLOW_API_KEY! });

// The main site does not have a CMS Locale set, so it needs to not be set on
// the object, or the API will fail.
const cmsLocaleId = process.env.WEBFLOW_CMS_LOCALE
  ? { cmsLocaleId: process.env.WEBFLOW_CMS_LOCALE! }
  : {};

export async function createNewWebflowBlogPost(
  fieldData: any,
): Promise<CollectionItem> {
  return await client.collections.items.createItem(
    process.env.WEBFLOW_COLLECTION_ID!,
    {
      fieldData,
      ...cmsLocaleId,
    },
  );
}

export async function updateStagedWebflowBlogPost(
  fieldData: any,
  { existingWebflowId }: { existingWebflowId: string },
): Promise<CollectionItem> {
  return await client.collections.items.updateItem(
    process.env.WEBFLOW_COLLECTION_ID!,
    existingWebflowId,
    {
      fieldData,
      ...cmsLocaleId,
    },
  );
}

// Immediately pushes updates to a live blog post. This should only be done
// for Preview webflow, or if a user's intent is to update live.
export async function updateLiveBlogPost(
  fieldData: any,
  { existingWebflowId }: { existingWebflowId: string },
): Promise<CollectionItemListNoPagination> {
  return await client.collections.items.updateItemsLive(
    process.env.WEBFLOW_COLLECTION_ID!,
    {
      items: [
        {
          id: existingWebflowId,
          fieldData,
          ...cmsLocaleId,
        },
      ],
    },
  );
}

export async function listStagedWebflowBlogPosts(): Promise<CollectionItemList> {
  return await client.collections.items.listItems(
    process.env.WEBFLOW_COLLECTION_ID!,
    {
      ...cmsLocaleId,
      offset: 0,
      limit: 1000,
      sortBy: "lastPublished",
      sortOrder: "asc",
    },
  );
}

export async function listTeamMembers(): Promise<CollectionItemList> {
  return await client.collections.items.listItems(
    process.env.WEBFLOW_TEAM_MEMBER_COLLECTION_ID!,
    {
      ...cmsLocaleId,
      offset: 0,
      limit: 1000,
    },
  );
}

export async function listBlogCategories(): Promise<CollectionItemList> {
  return await client.collections.items.listItems(
    process.env.WEBFLOW_BLOG_CATEGORY_COLLECTION_ID!,
    {
      ...cmsLocaleId,
      offset: 0,
      limit: 1000,
    },
  );
}

export async function publishWebflowSite(siteId: string) {
  return await client.sites.publish(siteId, {
    customDomains: [],
    publishToWebflowSubdomain: true,
  });
}

export async function uploadWebflowImage(
  imageData: ArrayBuffer,
  contentType: string,
  title: string,
): Promise<string> {
  const { uploadUrl, uploadDetails, hostedUrl } = await client.assets.create(
    process.env.WEBFLOW_SITE_ID!,
    {
      fileName: title,
      fileHash: createHash("md5")
        .update(Buffer.from(imageData).toString("binary"))
        .digest("hex"),
    },
  );
  if (!uploadUrl || !uploadDetails || !hostedUrl) {
    throw new Error("Failed to create asset");
  }
  const form = new FormData();
  form.append("acl", uploadDetails.acl!);
  form.append("bucket", uploadDetails.bucket!);
  form.append("X-Amz-Algorithm", uploadDetails.xAmzAlgorithm!);
  form.append("X-Amz-Credential", uploadDetails.xAmzCredential!);
  form.append("X-Amz-Date", uploadDetails.xAmzDate!);
  form.append("key", uploadDetails.key!);
  form.append("Policy", uploadDetails.policy!);
  form.append("X-Amz-Signature", uploadDetails.xAmzSignature!);
  form.append("success_action_status", uploadDetails.successActionStatus!);
  form.append("Content-Type", uploadDetails.contentType!);
  form.append("Cache-Control", uploadDetails.cacheControl!);
  form.append("file", new Blob([imageData]), title);
  const response = await fetch(uploadUrl, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to upload ${title}. Response status: ${response.status}. Error:
      ${error}`);
  }
  return hostedUrl;
}
