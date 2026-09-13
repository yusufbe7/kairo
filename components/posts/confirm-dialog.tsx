"use client";

import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/** Destructive actions always go through an explicit confirmation. */
export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onClose, pending }: {
  open: boolean; title: string; description: string; confirmLabel: string; onConfirm: () => void; onClose: () => void; pending?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[400px]">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="danger" onClick={onConfirm} disabled={pending}>
            {pending && <LoaderCircle size={13} className="animate-spin" />}{confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
