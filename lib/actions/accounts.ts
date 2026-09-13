"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/lib/workspace/context";
import { clearConnectSession, readConnectSession } from "@/lib/integrations/connect-session";
import type { ConnectableAccount } from "@/lib/integrations/types";
import { safeAction } from "@/lib/actions/safe-action";
import { AppError } from "@/lib/errors";
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

const finishSchema = z.object({
  platform: platformSchema,
  externalAccountId: z.string().min(1).max(128),
});

/**
 * Stores the account the user picked when a provider offered several.
 *
 * The candidates are fetched again from the provider rather than trusted from the
 * browser: the only thing that crossed the wire was an id, so the token that ends up
 * encrypted in the database is always one the provider just handed us.
 */
export const completeConnection = safeAction("accounts.complete_connection", finishSchema, async (input) => {
  const ctx = await requireWorkspace("account.manage");
  const session = await readConnectSession(input.platform);

  if (session.workspaceId !== ctx.workspace.id) {
    throw new AppError("FORBIDDEN", "That connection was started in a different workspace.");
  }
  await accounts.assertCanConnect(ctx, input.platform);

  const { listConnectable } = await import(`@/lib/integrations/${input.platform}/auth`)
    .catch(() => ({ listConnectable: null }));
  if (!listConnectable) throw new AppError("NOT_SUPPORTED", "That platform can't be connected in this version.");

  const candidates: ConnectableAccount[] = await listConnectable(session.userToken);
  const chosen = candidates.find((c) => c.externalAccountId === input.externalAccountId);
  if (!chosen) throw new AppError("NOT_FOUND", "That account is no longer available. Start connecting again.");

  await accounts.upsertConnectedAccount({
    workspaceId: ctx.workspace.id,
    userId: ctx.userId,
    platform: input.platform,
    externalAccountId: chosen.externalAccountId,
    handle: chosen.handle,
    displayName: chosen.displayName ?? null,
    avatarUrl: chosen.avatarUrl ?? null,
    followers: chosen.followers ?? null,
    scopes: chosen.scopes ?? [],
    accessToken: chosen.accessToken,
    refreshToken: chosen.refreshToken ?? null,
    expiresAt: chosen.expiresAt ?? null,
    metadata: session.providerUserId ? { provider_user_id: session.providerUserId } : {},
  });

  await clearConnectSession();
  revalidatePath("/accounts");
  return { handle: chosen.handle };
});
