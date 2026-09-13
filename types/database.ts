/**
 * Row shapes for the tables the app reads. Regenerate exact types with
 * `npm run db:types` (supabase gen types) once your project is linked.
 */
export type Platform = "instagram" | "facebook" | "tiktok" | "linkedin" | "x" | "youtube" | "telegram";
export type WorkspaceRole = "owner" | "admin" | "editor" | "member" | "viewer";
export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed";
export type PostFormat = "post" | "reel" | "story" | "thread";
export type TargetStatus = "pending" | "queued" | "processing" | "published" | "failed" | "retrying" | "canceled";
export type JobStatus = "queued" | "processing" | "completed" | "failed" | "retrying" | "canceled";
export type AccountStatus = "connected" | "needs_attention" | "expired" | "error" | "disconnected";
export type MediaKind = "image" | "video" | "gif";
export type MetricSource = "live" | "cached" | "demo";

export interface WorkspaceRow {
  id: string; name: string; slug: string; timezone: string; owner_id: string; plan_id: string;
  status: "active" | "suspended"; is_demo: boolean; created_at: string; updated_at: string;
}
export interface ProfileRow {
  id: string; email: string | null; full_name: string | null; avatar_url: string | null; job_title: string | null;
  locale: string; is_super_admin: boolean; status: "active" | "suspended";
  notification_prefs: Record<string, boolean>; created_at: string; last_active_at: string | null;
}
export interface MemberRow { workspace_id: string; user_id: string; role: WorkspaceRole; created_at: string }
export interface InvitationRow { id: string; workspace_id: string; email: string; role: WorkspaceRole; status: string; expires_at: string; created_at: string }
export interface SocialAccountRow {
  id: string; workspace_id: string; platform: Platform; external_account_id: string; handle: string; display_name: string | null;
  avatar_url: string | null; followers_count: number | null; status: AccountStatus; last_synced_at: string | null;
  last_error: string | null; token_expires_at: string | null; is_demo: boolean; created_at: string;
}
export interface PostRow {
  id: string; workspace_id: string; author_id: string | null; title: string; caption: string; format: PostFormat;
  status: PostStatus; scheduled_at: string | null; published_at: string | null; timezone: string; last_error: string | null;
  created_at: string; updated_at: string;
}
export interface PostTargetRow {
  id: string; post_id: string; workspace_id: string; platform: Platform; social_account_id: string | null;
  caption_override: string | null; status: TargetStatus; external_post_id: string | null; external_url: string | null;
  last_error: string | null; published_at: string | null;
}
export interface PostMediaRow { post_id: string; media_id: string; workspace_id: string; position: number }
export interface MediaAssetRow {
  id: string; workspace_id: string; uploaded_by: string | null; bucket: string; storage_path: string; file_name: string;
  mime_type: string; kind: MediaKind; size_bytes: number; width: number | null; height: number | null;
  duration_seconds: number | null; created_at: string;
}
export interface ScheduledJobRow {
  id: string; workspace_id: string; post_id: string; run_at: string; status: JobStatus; attempts: number;
  max_attempts: number; queue_job_id: string | null; last_error: string | null; created_at: string;
}
export interface ConversationRow {
  id: string; workspace_id: string; social_account_id: string | null; platform: Platform; external_thread_id: string;
  participant_name: string; participant_handle: string | null; participant_avatar_url: string | null;
  last_message_preview: string | null; last_message_at: string | null; unread_count: number;
}
export interface MessageRow { id: string; conversation_id: string; direction: "incoming" | "outgoing"; body: string; sent_at: string }
export interface AnalyticsDailyRow {
  workspace_id: string; social_account_id: string; platform: Platform; date: string; reach: number | null; impressions: number | null;
  engagement: number | null; likes: number | null; comments: number | null; shares: number | null; clicks: number | null;
  followers: number | null; source: MetricSource; fetched_at: string;
}
export interface AnalyticsPostRow {
  post_target_id: string; platform: Platform; reach: number | null; impressions: number | null; likes: number | null;
  comments: number | null; shares: number | null; clicks: number | null; engagement_rate: number | null; source: MetricSource; fetched_at: string;
}
export interface NotificationRow { id: string; type: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }
/** `null` means unlimited on every limit — always compare with `limitReached`. */
export interface PlanLimits { posts_per_month: number | null; social_accounts: number | null; members: number | null; ai_generations: number | null; api_requests: number | null }
export interface PlanRow { id: string; name: string; price_cents: number; limits: PlanLimits }
export interface SubscriptionRow { workspace_id: string; plan_id: string; status: string; current_period_end: string | null }
export interface ApiKeyRow { id: string; workspace_id: string; name: string; prefix: string; last_used_at: string | null; revoked_at: string | null; created_at: string }
