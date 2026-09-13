"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/lib/workspace/context";
import { safeAction } from "@/lib/actions/safe-action";
import * as accounts from "@/lib/services/accounts";
import { platformSchema } from "@/lib/validation/posts";

/**
 * Verifies the workspace may connect this provider, then returns the OAuth start URL.
 * The route handler generates the state cookie and redirects to the provider.
 */
export const beginConnect = safeAction("accounts.connect", z.object({ platform: platformSchema }), async ({ platform }) => {
  const ctx = await requireWorkspace("account.manage");
  await accounts.assertCanConnect(ctx, platform);
  return { url: `/api/accounts/${platform}/connect` };
});

export const disconnectAccount = safeAction("accounts.disconnect", z.object({ accountId: z.string().uuid() }), async ({ accountId }) => {
  const ctx = await requireWorkspace("account.manage");
  await accounts.disconnectAccount(ctx, accountId);
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { disconnected: true };
});
