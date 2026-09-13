"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/lib/workspace/context";
import { safeAction } from "@/lib/actions/safe-action";
import { markNotificationsRead } from "@/lib/services/notifications";

export const markNotificationsReadAction = safeAction("notifications.read", z.object({ ids: z.array(z.string().uuid()).optional() }), async ({ ids }) => {
  const ctx = await requireWorkspace("workspace.read");
  await markNotificationsRead(ctx, ids);
  revalidatePath("/", "layout");
  return { read: true };
});
