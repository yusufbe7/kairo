import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError, fromDbError } from "@/lib/errors";
import { providerStatus } from "@/lib/integrations/registry";
import { audit } from "@/lib/services/audit";
import { describeLimit, getPlanLimits, limitReached } from "@/lib/services/usage";
import type { WorkspaceContext } from "@/lib/workspace/context";
import type { SocialAccountRow } from "@/types/database";
import type { AccountView, PlatformId } from "@/types/social";

export async function listAccounts(ctx: WorkspaceContext): Promise<AccountView[]> {
  const { data, error } = await ctx.supabase
    .from("social_accounts").select("*").eq("workspace_id", ctx.workspace.id)
    .neq("status", "disconnected").order("created_at", { ascending: true });
  if (error) throw fromDbError(error);
  return ((data ?? []) as SocialAccountRow[]).map((a) => ({
    id: a.id, platform: a.platform, handle: a.handle, displayName: a.display_name, followers: a.followers_count,
    status: a.status, lastSyncedAt: a.last_synced_at, lastError: a.last_error, isDemo: a.is_demo,
  }));
}

/** Checks the workspace may connect another account of this platform, and that the provider is configured. */
export async function assertCanConnect(ctx: WorkspaceContext, platform: PlatformId) {
  const status = providerStatus(platform);
  if (!status.configured) {
    throw new AppError("NOT_CONFIGURED", `${platform} isn't configured on this deployment yet. An administrator needs to add its API credentials.`);
  }
  if (!status.capabilities.connect) {
    throw new AppError("NOT_SUPPORTED", `Connecting ${platform} isn't available yet in this version.`);
  }
  const [limits, { count }] = await Promise.all([
    getPlanLimits(ctx.workspace.id),
    ctx.supabase.from("social_accounts").select("id", { count: "exact", head: true }).eq("workspace_id", ctx.workspace.id).neq("status", "disconnected"),
  ]);
  if (limitReached(count ?? 0, limits.social_accounts)) {
    throw new AppError("LIMIT_REACHED", `Your plan includes ${describeLimit(limits.social_accounts)} social accounts. Upgrade to connect more.`);
  }
}

export async function disconnectAccount(ctx: WorkspaceContext, accountId: string) {
  const { data } = await ctx.supabase.from("social_accounts").select("platform, handle").eq("id", accountId).eq("workspace_id", ctx.workspace.id).single();
  if (!data) throw new AppError("NOT_FOUND", "We couldn't find that account.");
  // Deleting cascades to oauth_tokens, so the provider token is removed with it.
  const { error } = await ctx.supabase.from("social_accounts").delete().eq("id", accountId);
  if (error) throw fromDbError(error, "We couldn't disconnect that account.");
  await audit({ action: "account.disconnected", actorId: ctx.userId, workspaceId: ctx.workspace.id, targetType: "social_account", targetId: accountId, metadata: { platform: (data as { platform: string }).platform } });
}

/** Called by OAuth callbacks (service role) after a successful token exchange. */
export async function upsertConnectedAccount(params: {
  workspaceId: string; userId: string; platform: PlatformId; externalAccountId: string; handle: string;
  displayName?: string | null; avatarUrl?: string | null; scopes?: string[];
  accessToken: string; refreshToken?: string | null; expiresAt?: Date | null;
}) {
  const { encryptSecret } = await import("@/lib/security/crypto");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("social_accounts")
    .upsert({
      workspace_id: params.workspaceId, platform: params.platform, external_account_id: params.externalAccountId,
      handle: params.handle, display_name: params.displayName ?? null, avatar_url: params.avatarUrl ?? null,
      status: "connected", scopes: params.scopes ?? [], connected_by: params.userId, last_error: null,
      token_expires_at: params.expiresAt?.toISOString() ?? null, last_synced_at: new Date().toISOString(),
    }, { onConflict: "workspace_id,platform,external_account_id" })
    .select("id")
    .single();
  if (error) throw fromDbError(error, "We couldn't save that connection.");

  const accountId = (data as { id: string }).id;
  const { error: tokenError } = await admin.from("oauth_tokens").upsert({
    social_account_id: accountId,
    access_token_encrypted: encryptSecret(params.accessToken),
    refresh_token_encrypted: params.refreshToken ? encryptSecret(params.refreshToken) : null,
    expires_at: params.expiresAt?.toISOString() ?? null,
  }, { onConflict: "social_account_id" });
  if (tokenError) throw fromDbError(tokenError, "We couldn't store that connection securely.");

  await audit({ action: "account.connected", actorId: params.userId, workspaceId: params.workspaceId, targetType: "social_account", targetId: accountId, metadata: { platform: params.platform } });
  return accountId;
}

/** Server-only: decrypts a provider token for publishing/analytics. Never expose the result to the client. */
export async function getAccessToken(accountId: string): Promise<string> {
  const { decryptSecret } = await import("@/lib/security/crypto");
  const { data, error } = await createAdminClient().from("oauth_tokens").select("access_token_encrypted, expires_at").eq("social_account_id", accountId).single();
  if (error || !data) throw new AppError("NOT_CONFIGURED", "This account needs to be reconnected.");
  const row = data as { access_token_encrypted: string; expires_at: string | null };
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    await markAccountStatus(accountId, "expired", "Access token expired");
    throw new AppError("NOT_CONFIGURED", "This connection expired. Please reconnect the account.");
  }
  return decryptSecret(row.access_token_encrypted);
}

export async function markAccountStatus(accountId: string, status: "connected" | "needs_attention" | "expired" | "error", error?: string) {
  await createAdminClient().from("social_accounts").update({ status, last_error: error ?? null }).eq("id", accountId);
}
