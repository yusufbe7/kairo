"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      gap={8}
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border !border-border-strong !bg-[#15181E] !text-foreground !shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] !text-[13px] !font-sans",
          description: "!text-muted-foreground",
          actionButton: "!bg-white/10 !text-foreground !rounded-md",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-destructive",
          info: "[&_[data-icon]]:!text-brand",
        },
      }}
    />
  );
}
