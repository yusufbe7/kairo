"use client";

import { useEffect, useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { PostView } from "@/types/posts";

export function RescheduleDialog({ posts, onClose, onSave, pending }: {
  posts: PostView[] | null; onClose: () => void; onSave: (date: string, time: string) => void; pending?: boolean;
}) {
  const { today } = useWorkspace();
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("10:00");
  const [busy] = useTransition();

  useEffect(() => {
    if (posts?.length === 1) {
      setDate(posts[0].date >= today ? posts[0].date : today);
      setTime(posts[0].time);
    } else if (posts) {
      setDate(today);
      setTime("10:00");
    }
  }, [posts, today]);

  const many = (posts?.length ?? 0) > 1;
  return (
    <Dialog open={!!posts?.length} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[380px]">
        <DialogTitle>{many ? `Reschedule ${posts!.length} posts` : "Reschedule post"}</DialogTitle>
        <DialogDescription className="truncate pr-6">{many ? "They'll all go out at the same time." : posts?.[0]?.title}</DialogDescription>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <Input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} aria-label="Date" />
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
        </div>
        <div className="mt-[18px] flex justify-end gap-2">
          <Button size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="brand" onClick={() => onSave(date, time)} disabled={pending || busy}>
            {pending && <LoaderCircle size={13} className="animate-spin" />}Reschedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
