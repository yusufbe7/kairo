import type { Metadata } from "next";
import { MediaView } from "@/components/media/media-view";
import { getWorkspacePage } from "@/lib/workspace/context";
import { listMedia } from "@/lib/services/media";

export const metadata: Metadata = { title: "Media Library" };

export default async function Page() {
  const ctx = await getWorkspacePage();
  const media = await listMedia(ctx);
  return <MediaView media={media} storageUsed={media.reduce((a, m) => a + m.sizeBytes, 0)} />;
}
