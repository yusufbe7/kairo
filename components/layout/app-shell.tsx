"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sidebar, SidebarContent } from "./sidebar";
import { Topbar } from "./topbar";
import { BottomNav } from "./bottom-nav";
import type { NotificationRow } from "@/types/database";

export function AppShell({ children, notifications, isSuperAdmin }: { children: React.ReactNode; notifications: NotificationRow[]; isSuperAdmin: boolean }) {
  const [drawer, setDrawer] = useState(false);
  return (
    <div className="relative z-[1] flex min-h-screen">
      <Sidebar isSuperAdmin={isSuperAdmin} />
      <AnimatePresence>
        {drawer && (
          <motion.div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)}>
            <motion.aside
              className="flex h-full w-[264px] flex-col overflow-y-auto border-r border-border-strong bg-panel px-3 py-3.5"
              initial={{ x: -24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -24, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <SidebarContent onNavigate={() => setDrawer(false)} isSuperAdmin={isSuperAdmin} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="min-w-0 flex-1">
        <Topbar onOpenMenu={() => setDrawer(true)} notifications={notifications} />
        <main className="mx-auto max-w-[1500px] px-5 pb-28 pt-7 md:px-7 md:pb-16 md:pt-8 lg:px-9">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
