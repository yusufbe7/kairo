import type { Metadata } from "next";
import { PostsView } from "@/components/posts/posts-view";
import { getWorkspacePage } from "@/lib/workspace/context";
import { listPosts } from "@/lib/services/posts";
import { listPostsSchema } from "@/lib/validation/posts";

export const metadata: Metadata = { title: "Posts" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const ctx = await getWorkspacePage();

  // Unknown or malformed params fall back to defaults rather than erroring the page.
  const parsed = listPostsSchema.safeParse({ status: params.tab ?? "all", q: params.q, platform: params.platform, page: params.page, sort: params.sort });
  const query = parsed.success ? parsed.data : listPostsSchema.parse({});

  const { posts, total, counts } = await listPosts(ctx, query);
  return (
    <PostsView
      posts={posts} counts={counts} total={total}
      query={{ status: query.status, q: query.q ?? "", platform: query.platform ?? "all", page: query.page, pageSize: query.pageSize, sort: query.sort }}
    />
  );
}
