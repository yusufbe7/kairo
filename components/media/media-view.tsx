"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Eye, Image as ImageIcon, LoaderCircle, Search, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Tip } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Thumb } from "@/components/social/thumb";
import { ConfirmDialog } from "@/components/posts/confirm-dialog";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { uploadWithTicket } from "@/lib/client/upload";
import { deleteMedia, planUpload, registerMedia } from "@/lib/actions/media";
import { run } from "@/lib/client/action";
import { fmtBytes, timeAgo } from "@/lib/format";
import type { MediaKind } from "@/types/database";
import type { MediaView as MediaItem } from "@/types/posts";

export function MediaView({ media, storageUsed }: { media: MediaItem[]; storageUsed: number }) {
  const router = useRouter();
  const { can } = useWorkspace();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | MediaKind>("all");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [confirming, setConfirming] = useState<MediaItem | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length || !can("media.upload")) return;
    const list = Array.from(files);
    setUploading(list.length);
    let done = 0;
    for (const file of list) {
      const plan = await run(planUpload({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }));
      if (!plan) { setUploading((n) => n - 1); continue; }
      const failure = await uploadWithTicket(plan, file);
      // "didn't upload" told nobody anything; the provider's reason is the whole point.
      if (failure) { toast.error(`${file.name}: ${failure}`); setUploading((n) => n - 1); continue; }
      const asset = await run(registerMedia({ path: plan.path, fileName: file.name, width: null, height: null, durationSeconds: null }));
      if (asset) done += 1;
      setUploading((n) => n - 1);
    }
    if (done) { toast.success(`${done} file${done > 1 ? "s" : ""} uploaded`); router.refresh(); }
  };

  const remove = (item: MediaItem) => start(async () => {
    if (await run(deleteMedia({ mediaId: item.id }), { success: "File deleted" })) { setConfirming(null); router.refresh(); }
  });

  const list = useMemo(
    () => media.filter((m) => (kind === "all" || m.kind === kind) && m.name.toLowerCase().includes(query.toLowerCase())),
    [media, kind, query],
  );

  return (
    <>
      <PageHeader title="Media Library" description={`${media.length} file${media.length === 1 ? "" : "s"} · ${fmtBytes(storageUsed)} used`}>
        {can("media.upload") && <Button variant="primary" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
          {uploading > 0 ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />}Upload
        </Button>}
      </PageHeader>
      <input ref={fileRef} type="file" multiple accept="image/*,video/*" hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />

      {can("media.upload") && (
        <div className="dropzone mb-5 px-5 py-[34px] text-center" data-drag={dragging}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void upload(e.dataTransfer.files); }}>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border-strong">
            {uploading > 0 ? <LoaderCircle size={18} className="animate-spin" /> : <Upload size={18} />}
          </div>
          <div className="mt-3 font-medium">{uploading > 0 ? `Uploading ${uploading} file${uploading > 1 ? "s" : ""}…` : "Drag files here to upload"}</div>
          <div className="mt-[3px] text-[12.5px] text-dim">
            JPG, PNG, WebP, GIF, MP4, MOV or WebM · or <button className="text-foreground underline underline-offset-[3px]" onClick={() => fileRef.current?.click()}>browse files</button>
          </div>
        </div>
      )}

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="relative max-w-[340px] flex-[1_1_220px]">
          <Search size={14} className="absolute left-3 top-[11px] text-dim" />
          <Input className="pl-8" placeholder="Search files" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search media" />
        </div>
        <Segmented aria-label="Type" value={kind} onChange={setKind}
          options={[{ value: "all" as const, label: "All" }, { value: "image" as const, label: "Images" }, { value: "video" as const, label: "Videos" }, { value: "gif" as const, label: "GIFs" }]} />
      </div>

      {list.length === 0 ? (
        <div className="surface">
          <EmptyState icon={ImageIcon} title={media.length ? "No files match those filters" : "No media yet"}
            text={media.length ? "Try another search or filter." : "Upload images and videos here, then attach them to any post."}
            action={media.length === 0 && can("media.upload") ? <Button size="sm" variant="primary" onClick={() => fileRef.current?.click()}>Upload a file</Button> : undefined} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence initial={false}>
            {list.map((m) => (
              <motion.div key={m.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} className="surface surface-lift group p-2">
                <div className="relative">
                  <Thumb i={0} src={m.kind === "video" ? undefined : m.url ?? undefined} video={m.kind === "video"} className="h-40 w-full" />
                  {m.kind === "gif" && <span className="absolute left-2 top-2 rounded-[5px] bg-black/50 px-1.5 py-px text-[10.5px] font-semibold">GIF</span>}
                  <div className="absolute inset-0 flex items-end justify-center gap-1.5 rounded-[10px] bg-gradient-to-t from-black/70 to-transparent pb-2.5 transition-opacity [@media(hover:hover)]:items-center [@media(hover:hover)]:bg-[rgba(5,6,8,0.55)] [@media(hover:hover)]:pb-0 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
                    <Tip label="Preview"><Button size="icon-sm" onClick={() => setPreview(m)} aria-label={`Preview ${m.name}`}><Eye size={14} /></Button></Tip>
                    <Button size="sm" variant="primary" asChild><Link href={`/create?media=${m.id}`}>Use in post</Link></Button>
                    {can("media.upload") && <Tip label="Delete"><Button size="icon-sm" onClick={() => setConfirming(m)} aria-label={`Delete ${m.name}`}><Trash2 size={14} /></Button></Tip>}
                  </div>
                </div>
                <div className="px-1 pb-1 pt-2.5">
                  <div className="truncate text-[13px] font-medium">{m.name}</div>
                  <div className="mt-[3px] flex justify-between text-[11.5px] text-dim">
                    <span>{m.width && m.height ? `${m.width} × ${m.height}` : fmtBytes(m.sizeBytes)}</span>
                    <span>{m.uses ? `Used ${m.uses}×` : "Unused"}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-[640px] p-3">
          {preview && (
            <>
              {preview.kind === "video" && preview.url ? (
                <video src={preview.url} controls className="h-[380px] w-full rounded-xl bg-black" />
              ) : (
                <Thumb i={0} src={preview.url ?? undefined} className="h-[380px] w-full" rounded="rounded-xl" />
              )}
              <div className="px-1.5 pb-1 pt-3">
                <DialogTitle className="text-sm font-medium">{preview.name}</DialogTitle>
                <DialogDescription className="text-xs text-dim">
                  {preview.width && preview.height ? `${preview.width} × ${preview.height} · ` : ""}{fmtBytes(preview.sizeBytes)} · uploaded {timeAgo(preview.createdAt)}
                </DialogDescription>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirming}
        title="Delete this file?"
        description={confirming?.uses ? `It's used in ${confirming.uses} post${confirming.uses === 1 ? "" : "s"}. Those posts will lose the attachment.` : "This removes the file from storage. It can't be undone."}
        confirmLabel="Delete"
        pending={pending}
        onConfirm={() => confirming && remove(confirming)}
        onClose={() => setConfirming(null)}
      />
    </>
  );
}
