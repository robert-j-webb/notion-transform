import { NextRequest, NextResponse } from "next/server";
import type {
  PageObjectResponse,
  DataSourceObjectResponse,
} from "@notionhq/client";
import { publishBlogPost } from "@/lib/combinedClient";

export async function POST(request: NextRequest) {
  if (request.nextUrl.searchParams.get("secret") !== process.env.WEB_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { notionId } = await request.json();
    if (!notionId) {
      return NextResponse.json(
        { error: "Notion ID is required" },
        { status: 400 }
      );
    }

    await publishBlogPost({ notionId });

    return NextResponse.json({
      success: true,
      message: "Blog post updated successfully in Webflow",
    });
  } catch (error) {
    console.error("Error on publish:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to publish to webflow";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export type BlogPost = PageObjectResponse | DataSourceObjectResponse;
