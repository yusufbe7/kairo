import type { Metadata } from "next";
import { CreateEditor } from "@/components/editor/create-editor";
import { getWorkspacePage } from "@/lib/workspace/context";
import { listAccounts } from "@/lib/services/accounts";
import { listMedia } from "@/lib/services/media";
import { getPost } from "@/lib/services/posts";
import { isAiConfigured } from "@/lib/ai";
import type { PostView } from "@/types/posts";

export const metadata: Metadata = { title: "Create" };

export default async function Page({ searchParams }: { searchParams: Promise<{ post?: string; draft?: string }> }) {
  const { post: postId, draft } = await searchParams;
  const ctx = await getWorkspacePage("post.draft");
  const [accounts, library] = await Promise.all([listAccounts(ctx), listMedia(ctx)]);

  let post: PostView | null = null;
  if (postId) {
    try { post = await getPost(ctx, postId); } catch { post = null; }
  }

  return <CreateEditor accounts={accounts} library={library} post={post} initialText={draft?.slice(0, 4000)} aiEnabled={isAiConfigured()} />;
}
