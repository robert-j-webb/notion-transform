import morphdom from "morphdom";

// To be used when we want to directly view blog posts as they are being written.

async function setUpBlogReload() {
  if (!window.location.search.includes("notionPageId")) {
    return;
  }
  const searchParams = new URLSearchParams(window.location.search);
  const notionPageId = searchParams.get("notionPageId");
  const renderUrl = new URL(searchParams.get("renderUrl"));
  const renderSecret = searchParams.get("secret");

  // TODO: Replace '<your_vercel_domain>' with your company's Vercel subdomain
  if (
    renderUrl.hostname !== "localhost" &&
    renderUrl.hostname !== "<your_vercel_domain>.vercel.app"
  ) {
    throw new Error("Invalid render URL");
  }
  document.querySelector("main").style.opacity = 0;
  // TODO: Replace with your company's default cover image URL from your Webflow CDN
  const defaultCoverImg =
    "https://cdn.prod.website-files.com/695beebe2d66516d8dc3aded/695befa27be4973baa34c30c_tinybaby.jpg";

  // TODO: Replace everything in this loop so it fits your blog template.
  while (true) {
    const blogPost = await fetch(
      `${renderUrl.origin}/api/notion?notionPageId=${notionPageId}&isPublish=false&secret=${renderSecret}`,
    ).then((response) => response.json());
    const properties = blogPost.page?.properties;
    const coverImg =
      properties["Cover Photo"]?.files?.[0]?.file?.url ?? defaultCoverImg;

    // Update the dom with hand rolled versions of the components.
    if (document.querySelector(".main-blog-body")) {
      morphdom(
        document.querySelector(".main-blog-body"),
        `<div class="main-blog-body">${blogPost.html}</div>`,
      );
    }
    if (document.querySelector(".blog-cover-image")) {
      morphdom(
        document.querySelector(".blog-cover-image"),
        `<div class="blog-cover-image"><img src="${coverImg}" alt=""></div>`,
      );
    }

    document.title = blogPost.title;
    if (document.querySelector("h1")) {
      document.querySelector("h1").textContent = blogPost.title;
    }
    document.querySelector("main").style.opacity = 1;
    // Formate current date like `October 29, 2020`
    if (document.querySelector(".blog-date")) {
      document.querySelector(".blog-date").textContent =
        new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        });
    }

    window.setupBlog?.();
    window.renderMathInElement?.(document.body);

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setUpBlogReload();
  });
} else {
  setUpBlogReload();
}
