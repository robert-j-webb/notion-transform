import {
  BlockObjectResponse,
  PageObjectResponse,
  PartialBlockObjectResponse,
  RichTextItemResponse,
} from "@notionhq/client";
import { getNotionPage, listBlocksChildren } from "./notionClient";
import { uploadWebflowImage } from "./webflowClient";
import { createShikiHighlighter } from "./shikiHighlighter";

type Block = BlockObjectResponse | PartialBlockObjectResponse;

type BlockWithChildren = BlockObjectResponse & {
  children?: BlockWithChildren[];
};

async function fetchAllBlocksRecursively(
  blockId: string,
): Promise<BlockWithChildren[]> {
  const allBlocks: BlockWithChildren[] = [];
  let cursor: string | undefined = undefined;

  do {
    const response = await listBlocksChildren({
      blockId,
      startCursor: cursor,
    });

    const blocks = response.results.filter(
      (block: Block): block is BlockObjectResponse => "type" in block,
    ) as BlockWithChildren[];

    for (const block of blocks) {
      if (block.has_children) {
        block.children = await fetchAllBlocksRecursively(block.id);
      }
    }

    allBlocks.push(...blocks);
    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return allBlocks;
}

async function processImage(
  url: string,
  options: ConvertToHtmlOptions,
): Promise<string> {
  try {
    if (options.isPublish) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") || "image/png";
      const title = new URL(url).pathname.split("/").pop() || "unknown.jpg";
      return await uploadWebflowImage(arrayBuffer, contentType, title);
    } else {
      return url;
    }
  } catch (error) {
    console.error("Error converting image to base64:", error);
    return url;
  }
}

function richTextToHtml(
  richTextArray: RichTextItemResponse[],
  options: ConvertToHtmlOptions,
): string {
  if (!richTextArray || richTextArray.length === 0) return "";

  return richTextArray
    .map((text) => {
      let content = text.plain_text;

      if (text.annotations) {
        if (text.annotations.bold) content = `<strong>${content}</strong>`;
        if (text.annotations.italic) content = `<em>${content}</em>`;
        if (text.annotations.strikethrough) content = `<s>${content}</s>`;
        if (text.annotations.underline) content = `<u>${content}</u>`;
        if (text.annotations.code) content = `<code>${content}</code>`;
      }

      if (text.href) {
        content = `<a href="${text.href}" target="_blank" rel="noopener noreferrer">${content}</a>`;
      }

      if (text.type === "equation") {
        content = `<p>$$${content}$$</p>`;
      }

      return content;
    })
    .join("");
}

async function blockToHtml(
  block: BlockWithChildren,
  options: ConvertToHtmlOptions,
): Promise<string> {
  if (!("type" in block)) return "";

  const type = block.type;
  const blockData = block as any;

  try {
    switch (type) {
      case "paragraph": {
        const text = richTextToHtml(blockData.paragraph.rich_text, options);
        return `<p>${text || "<br>"}</p>`;
      }

      case "heading_1": {
        const text = richTextToHtml(blockData.heading_1.rich_text, options);
        return `<h1>${text}</h1>`;
      }

      case "heading_2": {
        const text = richTextToHtml(blockData.heading_2.rich_text, options);
        return `<h2>${text}</h2>`;
      }

      case "heading_3": {
        const text = richTextToHtml(blockData.heading_3.rich_text, options);
        return `<h3>${text}</h3>`;
      }

      case "bulleted_list_item": {
        const text = richTextToHtml(
          blockData.bulleted_list_item.rich_text,
          options,
        );
        let childrenHtml = "";
        if (block.children && block.children.length > 0) {
          childrenHtml = await groupBlocks(block.children, options);
        }
        return `<li>${text}${childrenHtml}</li>`;
      }

      case "numbered_list_item": {
        const text = richTextToHtml(
          blockData.numbered_list_item.rich_text,
          options,
        );
        let childrenHtml = "";
        if (block.children && block.children.length > 0) {
          childrenHtml = await groupBlocks(block.children, options);
        }
        return `<li>${text}${childrenHtml}</li>`;
      }

      case "to_do": {
        const text = richTextToHtml(blockData.to_do.rich_text, options);
        const checked = blockData.to_do.checked ? "checked" : "";
        let childrenHtml = "";
        if (block.children && block.children.length > 0) {
          childrenHtml = await groupBlocks(block.children, options);
        }
        return `<div class="todo-item"><input type="checkbox" ${checked} disabled /> ${text}${childrenHtml}</div>`;
      }

      case "toggle": {
        const text = richTextToHtml(blockData.toggle.rich_text, options);
        let childrenHtml = "";
        if (block.children && block.children.length > 0) {
          childrenHtml = await groupBlocks(block.children, options);
        }
        return `<details><summary>${text}</summary>${childrenHtml}</details>`;
      }

      // This part was specific to my company. But you should modify it to get
      // codeblocks to appear the way you want.
      case "code": {
        const text = blockData.code.rich_text
          .map((t: any) => t.plain_text)
          .join("");
        const language: string = blockData.code.language || "plaintext";
        const displayLanguage = language;
        try {
          const highlighter = await createShikiHighlighter();
          const html = highlighter.codeToHtml(text, {
            lang: displayLanguage,
            theme: "material-theme-palenight",
          });
          return (
            // Wrapper HTML allows backwards compatibility, adds code copy button.
            `<div class="w-embed"><div class="code-container">
<span class="label ${displayLanguage}">${displayLanguage}</span>
<div class="language-${displayLanguage}">
${html}
</div>
<button onclick="copyToClipboard(this)">Copy</button>
</div></div>`
              // use no-highlight to prevent HLJS from redoing highlights
              .replace("<code>", '<code class="no-highlight">')
          );
        } catch (error) {
          console.warn(
            `Shiki highlighting failed for language ${language}:`,
            error,
          );
          return `<pre data-language="${displayLanguage}"><code class="language-${language}">
          Error highlighting code block:
          ${error}
          code:
          ${escapeHtml(text)}</code></pre>`;
        }
      }

      case "quote": {
        const text = richTextToHtml(blockData.quote.rich_text, options);
        return `<blockquote>${text}</blockquote>`;
      }

      case "callout": {
        const text = richTextToHtml(blockData.callout.rich_text, options);
        const icon =
          blockData.callout.icon && "emoji" in blockData.callout.icon
            ? blockData.callout.icon.emoji
            : "💡";
        let childrenHtml = "";
        if (block.children && block.children.length > 0) {
          childrenHtml = await groupBlocks(block.children, options);
        }
        return `<div class="callout"><span class="callout-icon">${icon}</span><div>${text}${childrenHtml}</div></div>`;
      }

      case "divider": {
        return `<hr />`;
      }

      case "image": {
        let url = "";
        if (blockData.image.type === "external") {
          url = blockData.image.external.url;
        } else if (blockData.image.type === "file") {
          url = blockData.image.file.url;
        }

        const base64Url = await processImage(url, options);

        const caption = blockData.image.caption
          ? richTextToHtml(blockData.image.caption, options)
          : "";
        return `<figure><img src="${base64Url}" alt="${caption}" />${
          caption ? `<figcaption>${caption}</figcaption>` : ""
        }</figure>`;
      }

      case "video": {
        let url = "";
        if (blockData.video.type === "external") {
          url = blockData.video.external.url;
        } else if (blockData.video.type === "file") {
          url = blockData.video.file.url;
        }
        return `<video controls src="${url}"></video>`;
      }

      case "file": {
        throw new Error("File block not supported");
      }

      case "bookmark": {
        const url = blockData.bookmark.url;
        const caption = blockData.bookmark.caption
          ? richTextToHtml(blockData.bookmark.caption, options)
          : url;
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="bookmark">${caption}</a>`;
      }

      case "table": {
        if (!block.children || block.children.length === 0) {
          return `<table></table>`;
        }

        const tableRows = block.children.filter(
          (child) => child.type === "table_row",
        );
        if (tableRows.length === 0) {
          return `<table></table>`;
        }

        let tableHtml = "<table>";

        if (tableRows.length > 0) {
          // Always treat first row as header
          const headerCells = (tableRows[0] as any).table_row.cells
            .map((cell: any) => `<th>${richTextToHtml(cell, options)}</th>`)
            .join("");
          tableHtml += `<thead><tr>${headerCells}</tr></thead>`;

          // Remaining rows as body
          if (tableRows.length > 1) {
            const bodyRows = tableRows
              .slice(1)
              .map((row) => {
                const cells = (row as any).table_row.cells
                  .map(
                    (cell: any) => `<td>${richTextToHtml(cell, options)}</td>`,
                  )
                  .join("");
                return `<tr>${cells}</tr>`;
              })
              .join("");
            tableHtml += `<tbody>${bodyRows}</tbody>`;
          }
        }

        tableHtml += "</table>";
        return tableHtml;
      }

      case "table_row": {
        const cells = blockData.table_row.cells
          .map((cell: any) => `<td>${richTextToHtml(cell, options)}</td>`)
          .join("");
        return `<tr>${cells}</tr>`;
      }

      default:
        return `<p class="unknown-block">Unsupported block type: ${type}</p>`;
    }
  } catch (error) {
    console.error(error);
    return `<pre><code>Error processing block type: ${type}
${error}</code></pre>`;
  }
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

async function groupBlocks(
  blocks: BlockWithChildren[],
  options: ConvertToHtmlOptions,
): Promise<string> {
  let html = "";
  let inBulletedList = false;
  let inNumberedList = false;

  for (let i = 0; i < blocks.length; i++) {
    try {
      const block = blocks[i];
      if (!("type" in block)) continue;

      // Skip table_row blocks as they're now handled by their parent table block
      if (block.type === "table_row") {
        continue;
      }

      if (block.type === "bulleted_list_item") {
        if (!inBulletedList) {
          html += "<ul>";
          inBulletedList = true;
        }
        html += await blockToHtml(block, options);
      } else {
        if (inBulletedList) {
          html += "</ul>";
          inBulletedList = false;
        }
      }

      if (block.type === "numbered_list_item") {
        if (!inNumberedList) {
          html += "<ol>";
          inNumberedList = true;
        }
        html += await blockToHtml(block, options);
      } else {
        if (inNumberedList) {
          html += "</ol>";
          inNumberedList = false;
        }
      }

      if (
        block.type !== "bulleted_list_item" &&
        block.type !== "numbered_list_item" &&
        block.type !== "table_of_contents" &&
        (block as any).type !== "table_row"
      ) {
        html += await blockToHtml(block, options);
      }
    } catch (error) {
      console.error("Error grouping blocks:", error);
      return `<pre><code>Error grouping blocks:
      ${error}</code></pre>`;
    }
  }

  if (inBulletedList) html += "</ul>";
  if (inNumberedList) html += "</ol>";

  return html;
}

export type NotionPageToHtmlResponse = {
  title?: string;
  html?: string;
  page?: PageObjectResponse;
  error?: string;
};

export async function notionPageToHtml(
  notionPageId: string,
  options: ConvertToHtmlOptions = { isPublish: false },
): Promise<NotionPageToHtmlResponse> {
  try {
    return await convertToHtml(notionPageId, options);
  } catch (error: any) {
    console.error("Error converting to HTML:", error);
    if (error.message && error.stack) {
      return {
        error: `${error.message}\n${error.stack}`,
      };
    }
    return {
      error: error ? JSON.stringify(error) : "unknown error",
    };
  }
}

type ConvertToHtmlOptions = {
  isPublish: boolean;
};
async function convertToHtml(
  notionPageId: string,
  options: ConvertToHtmlOptions,
): Promise<NotionPageToHtmlResponse> {
  const page = await getNotionPage({ notionPageId });
  let title = "Untitled";

  if ("properties" in page) {
    const titleProperty = Object.values(page.properties).find(
      (prop) => prop.type === "title",
    );
    if (titleProperty && "title" in titleProperty) {
      title = titleProperty.title
        .map((t: { plain_text: string }) => t.plain_text)
        .join("");
    }
  }

  const blocks = await fetchAllBlocksRecursively(notionPageId);

  const html = await groupBlocks(blocks, options);

  if (options.isPublish) {
    return {
      title,
      // Top 5 facts WEBFLOW DEVELOPERS doesn't want you to know: (Just kidding)
      // An undocumented Webflow API that allows us to inject HTML embeds
      html: `<div data-rt-embed-type='true'>${html}</div>`,
      page,
    };
  }

  return { title, html, page };
}
