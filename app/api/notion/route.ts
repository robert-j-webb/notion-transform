import { NextRequest, NextResponse } from "next/server";
import { notionPageToHtml } from "@/lib/notion-to-html";
import { createSlug } from "@/lib/combinedClient";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("secret") !== process.env.WEB_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const searchParams = request.nextUrl.searchParams;
    const notionPageId = searchParams.get("notionPageId");

    if (!notionPageId) {
      return NextResponse.json(
        { error: "Page ID is required" },
        { status: 400 },
      );
    }

    const isPublish = searchParams.get("isPublish") === "true";
    const { title, html, page, error } = await notionPageToHtml(notionPageId, {
      isPublish,
    });
    return NextResponse.json({
      title,
      html,
      page,
      slug: createSlug(title ?? "Unknown Title"),
      error: error ? JSON.stringify(error) : undefined,
    });
  } catch (error) {
    console.error("Error fetching Notion page:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch Notion page";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
