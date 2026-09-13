"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WorkspaceRole } from "@/types/database";
import { can, type Permission } from "@/lib/permissions";

export interface WorkspaceSummary { id: string; name: string; timezone: string; planId: string; role: WorkspaceRole }

interface Value {
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  /** Today's date (YYYY-MM-DD) in the workspace timezone, computed on the server. */
  today: string;
  user: { id: string; name: string; email: string };
  /** UI convenience only — the server re-checks every permission. */
  can: (permission: Permission) => boolean;
}

const Ctx = createContext<Value | null>(null);

export function WorkspaceProvider({ value, children }: { value: Omit<Value, "can">; children: ReactNode }) {
  return <Ctx.Provider value={{ ...value, can: (p) => can(value.workspace.role, p) }}>{children}</Ctx.Provider>;
}

export function useWorkspace(): Value {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}
