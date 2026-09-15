"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { LoaderCircle, Plus, Upload, X } from "lucide-react";
import { Thumb } from "@/components/social/thumb";
import { uploadWithTicket } from "@/lib/client/upload";
import { planUpload, registerMedia } from "@/lib/actions/media";
import { run } from "@/lib/client/action";
import type { MediaView } from "@/types/posts";
import { cn } from "@/lib/utils";

/**
 * Uploads go straight from the browser to Supabase Storage:
 *   plan (server validates + reserves a workspace path) → upload → register (server records the row).
 * The storage policy and a DB constraint both keep the object inside the workspace folder.
 */
async function uploadOne(file: File): Promise<MediaView | null> {
  // The server checks the workspace role and hands back a ticket for one object; the browser
  // only carries the bytes. Storage can no longer refuse an upload the server already allowed.
  const plan = await run(planUpload({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }));
  if (!plan) return null;

  const failure = await uploadWithTicket(plan, file);
  if (failure) {
    // Storage says exactly what went wrong — a missing bucket, a rejected file type, a size
    // limit. Replacing all of it with "try again" makes a permanent misconfiguration look like
    // a hiccup, and trying again never helps.
    toast.error(failure);
    return null;
  }

  const dimensions = await readDimensions(file);
  return run(registerMedia({ path: plan.path, fileName: file.name, ...dimensions }));
}

interface Dimensions { width: number | null; height: number | null; durationSeconds: number | null }

function readDimensions(file: File): Promise<Dimensions> {
  return new Promise<Dimensions>((resolve) => {
    const none: Dimensions = { width: null, height: null, durationSeconds: null };
    const url = URL.createObjectURL(file);
    const done = (value: Dimensions) => { URL.revokeObjectURL(url); resolve(value); };
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.onload = () => done({ width: img.naturalWidth, height: img.naturalHeight, durationSeconds: null });
      img.onerror = () => done(none);
      img.src = url;
    } else if (file.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.onloadedmetadata = () => done({ width: video.videoWidth, height: video.videoHeight, durationSeconds: Math.round(video.duration) || null });
      video.onerror = () => done(none);
      video.src = url;
    } else done(none);
  });
}

export function MediaPicker({ selected, onChange, library, disabled }: {
  selected: MediaView[]; onChange: (next: MediaView[]) => void; library: MediaView[]; disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [browsing, setBrowsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const add = async (files: FileList | null) => {
    if (!files?.length || disabled) return;
    setBusy(true);
    const uploaded: MediaView[] = [];
    for (const file of Array.from(files).slice(0, 10 - selected.length)) {
      const asset = await uploadOne(file);
      if (asset) uploaded.push(asset);
    }
    setBusy(false);
    if (uploaded.length) {
      onChange([...selected, ...uploaded].slice(0, 10));
      toast.success(`${uploaded.length} file${uploaded.length > 1 ? "s" : ""} uploaded`);
    }
  };

  const unpicked = library.filter((m) => !selected.some((s) => s.id === m.id));

  return (
    <div className={cn("dropzone", selected.length ? "p-3.5" : "p-[26px]")} data-drag={dragging}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); void add(e.dataTransfer.files); }}>
      <input ref={fileRef} type="file" multiple accept="image/*,video/*" hidden onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />

      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <AnimatePresence>
            {selected.map((m) => (
              <motion.div key={m.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-[84px]">
                <Thumb i={0} src={m.kind === "video" ? undefined : m.url ?? undefined} video={m.kind === "video"} className="h-[84px] w-[84px]" />
                <button onClick={() => onChange(selected.filter((x) => x.id !== m.id))} aria-label={`Remove ${m.name}`}
                  className="absolute right-[5px] top-[5px] flex h-[22px] w-[22px] items-center justify-center rounded-[7px] border border-border-strong bg-black/60"><X size={12} /></button>
              </motion.div>
            ))}
          </AnimatePresence>
          {selected.length < 10 && (
            <button onClick={() => fileRef.current?.click()} disabled={busy} aria-label="Add more media"
              className="flex h-[84px] w-[84px] items-center justify-center rounded-[10px] border border-dashed border-border-strong disabled:opacity-50">
              {busy ? <LoaderCircle size={18} className="animate-spin text-muted-foreground" /> : <Plus size={18} className="text-muted-foreground" />}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center">
          {busy ? <LoaderCircle size={20} className="animate-spin text-muted-foreground" /> : <Upload size={20} className="text-muted-foreground" />}
          <div className="mt-2.5 text-[13.5px] font-medium">{busy ? "Uploading…" : "Drop images or videos here"}</div>
          <div className="mt-0.5 text-[12.5px] text-dim">
            or <button type="button" className="text-foreground underline underline-offset-[3px]" onClick={() => fileRef.current?.click()}>browse files</button>
            {unpicked.length > 0 && <> · <button type="button" className="text-foreground underline underline-offset-[3px]" onClick={() => setBrowsing((v) => !v)}>pick from library</button></>}
          </div>
        </div>
      )}

      <AnimatePresence>
        {browsing && unpicked.length > 0 && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3.5 flex gap-2 overflow-x-auto pb-1">
              {unpicked.slice(0, 24).map((m) => (
                <button key={m.id} title={m.name} onClick={() => { onChange([...selected, m].slice(0, 10)); setBrowsing(false); }} className="shrink-0">
                  <Thumb i={0} src={m.kind === "video" ? undefined : m.url ?? undefined} video={m.kind === "video"} className="h-16 w-16" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
