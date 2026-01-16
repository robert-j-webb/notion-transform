import { connection } from "next/server";
import { BlogTable } from "../BlogTable";
import { getCombinedBlogPosts } from "@/lib/combinedClient";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  if ((await searchParams).secret !== process.env.WEB_SECRET) {
    return <div>Incorrect Secret</div>;
  }
  const blogPosts = await getCombinedBlogPosts(process.env.NOTION_DATABASE_ID!);
  return (
    <BlogTable
      blogPosts={blogPosts}
      isAdmin={true}
      webSecret={process.env.WEB_SECRET!}
    />
  );
}
