"use client";
import { useRouter } from "next/navigation";
import { Fragment, Suspense, useState } from "react";
import {
  Table,
  Button,
  Badge,
  Image,
  Container,
  Title,
  Text,
  Box,
  Alert,
  Code,
} from "@mantine/core";
import { CombinedBlogPost } from "@/lib/combinedClient";

export function BlogTable({
  blogPosts,
  isAdmin,
  webSecret,
}: {
  blogPosts: CombinedBlogPost[];
  isAdmin: boolean;
  webSecret: string;
}) {
  return (
    <Container size="xl" py="lg">
      <Title order={1} mb="xl">
        Blog Posts
      </Title>

      {blogPosts && blogPosts.length > 0 ? (
        <Table.ScrollContainer minWidth={800}>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                {/* You will have to modify the table headers to match your metadata */}
                <Table.Th>Cover</Table.Th>
                <Table.Th>Title</Table.Th>
                <Table.Th>Authors</Table.Th>
                <Table.Th>Team</Table.Th>
                <Table.Th>Last Edited(Notion)</Table.Th>
                <Table.Th>Last Published(Webflow)</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Suspense>
                {blogPosts.map((post: CombinedBlogPost) => (
                  <Fragment key={post.id}>
                    <BlogRow post={post} isAdmin={isAdmin} />
                    <LinkRow
                      post={post}
                      isAdmin={isAdmin}
                      webSecret={webSecret}
                    />
                  </Fragment>
                ))}
              </Suspense>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      ) : (
        <Box py="xl" ta="center">
          <Text c="dimmed">No blog posts found.</Text>
        </Box>
      )}
    </Container>
  );

  function BlogRow({ post }: { post: CombinedBlogPost; isAdmin: boolean }) {
    const router = useRouter();
    const properties = post.properties as Record<string, any>;

    const title =
      properties?.Name?.title?.[0]?.plain_text ||
      properties?.Title?.rich_text?.[0]?.plain_text ||
      "Untitled";

    const authors =
      properties?.Authors?.multi_select
        ?.map((author: any) => author.name)
        .join(", ") || "None";
    const notionCategory =
      properties?.Team?.select?.name ??
      properties?.Category?.select?.name ??
      "None";
    const publishDate = properties?.["Publish Date"]?.date?.start || "Not set";
    const coverPhoto = properties?.["Cover Photo"]?.files?.[0]?.file?.url;
    const lastEditedNotion = new Date(
      post.last_edited_time,
    ).toLocaleDateString();

    const lastPublished = post.webflowData?.lastPublished
      ? new Date(post.webflowData.lastPublished).toLocaleDateString()
      : "Not published";

    return (
      <Table.Tr
        key={post.id}
        style={{ cursor: "pointer" }}
        onClick={() => {
          router.push(`/preview?notionPageId=${post.id}`);
        }}
      >
        {/* In the same way you will have to modify the table data to match your metadata. */}
        <Table.Td>
          {coverPhoto ? (
            <Image
              src={coverPhoto}
              alt={`Cover for ${title}`}
              w={64}
              h={64}
              radius="md"
              fit="cover"
            />
          ) : (
            <Box w={64} h={64} bg="gray.2">
              <Text size="xs" c="dimmed">
                No image
              </Text>
            </Box>
          )}
        </Table.Td>
        <Table.Td>
          <Text size="sm" fw={500} lineClamp={2}>
            {title}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" lineClamp={2}>
            {authors}
          </Text>
        </Table.Td>
        <Table.Td>
          <Badge variant="light" color="blue" size="sm">
            {notionCategory}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Text size="sm" c="dimmed">
            {lastEditedNotion}
          </Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" c="dimmed">
            {lastPublished}
          </Text>
        </Table.Td>
      </Table.Tr>
    );
  }
}

function LinkRow({
  post,
  isAdmin,
  webSecret,
}: {
  post: CombinedBlogPost;
  isAdmin: boolean;
  webSecret: string;
}) {
  const url =
    typeof location !== "undefined"
      ? location.href
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://localhost:4000";
  const renderUrl = `https://${new URL(url).host}/api`;

  return (
    <Table.Tr key={`${post.id}-links`}>
      <Table.Td />
      {isAdmin && (
        <Table.Td>
          <ApiButton
            text="Publish"
            request={() =>
              fetch(`/api/publishWebflow?secret=${webSecret}`, {
                method: "POST",
                body: JSON.stringify({ notionId: post.id }),
              })
            }
          />
        </Table.Td>
      )}
      <Table.Td>
        <LinkButton href={post.url}>View on Notion</LinkButton>
      </Table.Td>
      <Table.Td>
        <LinkButton
          href={`${process.env.NEXT_PUBLIC_WEBFLOW_BLOG_PAGE}?notionPageId=${post.id}&renderUrl=${renderUrl}&secret=${webSecret}`}
        >
          View Preview
        </LinkButton>
      </Table.Td>
      {/* TODO: Replace '<your_webflow_staging>.webflow.io' with your company's Webflow staging domain */}
      <Table.Td>
        <LinkButton
          href={`https://<your_webflow_staging>.webflow.io/blog/${post.webflowData?.fieldData?.slug}`}
          disabled={!post.webflowData?.fieldData?.slug}
        >
          View Staged
        </LinkButton>
      </Table.Td>
      {/* TODO: Replace '<your_company>.com' with your company's production domain */}
      <Table.Td>
        <LinkButton
          href={`https://<your_company>.com/blog/${post.webflowData?.fieldData?.slug}`}
          disabled={!post.webflowData?.lastPublished}
        >
          View Live
        </LinkButton>
      </Table.Td>
    </Table.Tr>
  );
}

function ApiButton({
  text,
  request,
}: {
  text: string;
  request: () => Promise<Response>;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  return (
    <Box>
      <Button
        variant="filled"
        color={error ? "red" : "blue"}
        size="sm"
        loading={isLoading}
        onClick={(ev) => {
          ev.stopPropagation();
          setIsLoading(true);
          setError(undefined);
          request()
            .then(async (response) => {
              if (!response.ok) {
                const { error } = await response.json();
                setError(error);
                return;
              }
              return response.json();
            })
            .catch((error) => {
              console.error(error);
              setError(
                error instanceof Error ? error.message : "Unknown error",
              );
            })
            .finally(() => {
              setIsLoading(false);
            });
        }}
      >
        {text}
      </Button>
      {error && (
        <Alert variant="light" color="red" title="Error" mt="sm">
          <Code block>{error}</Code>
        </Alert>
      )}
    </Box>
  );
}

function LinkButton({
  href,
  children,
  disabled,
}: {
  href: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button
      component="a"
      href={href}
      target="_blank"
      variant="filled"
      color="blue"
      size="sm"
      disabled={disabled}
    >
      {children}
    </Button>
  );
}
