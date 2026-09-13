-- =====================================================================
-- Kairo — core schema
-- Users live in auth.users (Supabase Auth). Everything else hangs off
-- profiles (1:1 with auth.users) and workspaces (tenant boundary).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- ---------- Enums ----------
create type public.workspace_role as enum ('owner', 'admin', 'editor', 'member', 'viewer');
create type public.platform as enum ('instagram', 'facebook', 'tiktok', 'linkedin', 'x', 'youtube', 'telegram');
create type public.post_format as enum ('post', 'reel', 'story', 'thread');
create type public.post_status as enum ('draft', 'scheduled', 'publishing', 'published', 'failed');
create type public.target_status as enum ('pending', 'queued', 'processing', 'published', 'failed', 'retrying', 'canceled');
create type public.job_status as enum ('queued', 'processing', 'completed', 'failed', 'retrying', 'canceled');
create type public.account_status as enum ('connected', 'needs_attention', 'expired', 'error', 'disconnected');
create type public.media_kind as enum ('image', 'video', 'gif');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'paused');
create type public.log_level as enum ('info', 'warn', 'error');
create type public.message_direction as enum ('incoming', 'outgoing');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
create type public.metric_source as enum ('live', 'cached', 'demo');
create type public.record_status as enum ('active', 'suspended');

-- ---------- Helpers ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- Reference data ----------
create table public.plans (
  id text primary key,                         -- 'free' | 'starter' | 'pro' | 'business'
  name text not null,
  price_cents integer not null default 0,
  limits jsonb not null default '{}'::jsonb,   -- { posts_per_month, social_accounts, members, ai_generations, api_requests }
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  key public.workspace_role primary key,
  name text not null,
  description text not null,
  rank integer not null                         -- higher = more privileged; used for "at least" checks
);

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default true,
  description text,
  updated_at timestamptz not null default now()
);

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------- Identity ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email extensions.citext,
  full_name text,
  avatar_url text,
  job_title text,
  locale text not null default 'en',
  is_super_admin boolean not null default false,
  status public.record_status not null default 'active',
  notification_prefs jsonb not null default '{"published":true,"failed":true,"messages":true,"weekly":false,"product":false}'::jsonb,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Tenancy ----------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique,
  timezone text not null default 'UTC',
  owner_id uuid not null references auth.users (id) on delete restrict,
  plan_id text not null default 'free' references public.plans (id),
  status public.record_status not null default 'active',
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspaces_owner_idx on public.workspaces (owner_id);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on public.workspace_members (user_id);

create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email extensions.citext not null,
  role public.workspace_role not null default 'member' check (role <> 'owner'),
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspace_invitations_ws_idx on public.workspace_invitations (workspace_id, status);
create unique index workspace_invitations_pending_uniq on public.workspace_invitations (workspace_id, email) where status = 'pending';

-- ---------- Social accounts ----------
create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  platform public.platform not null,
  external_account_id text not null,
  handle text not null,
  display_name text,
  avatar_url text,
  followers_count integer,
  status public.account_status not null default 'connected',
  scopes text[] not null default '{}',
  token_expires_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  connected_by uuid references auth.users (id) on delete set null,
  is_demo boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, platform, external_account_id)
);
create index social_accounts_ws_idx on public.social_accounts (workspace_id);
create index social_accounts_platform_idx on public.social_accounts (platform);
create index social_accounts_status_idx on public.social_accounts (status);

-- Provider tokens: encrypted at the application layer (AES-256-GCM, TOKEN_ENCRYPTION_KEY)
-- and readable ONLY by the service role (RLS enabled, no policies, grants revoked).
create table public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  social_account_id uuid not null unique references public.social_accounts (id) on delete cascade,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_type text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Media ----------
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  uploaded_by uuid references auth.users (id) on delete set null,
  bucket text not null default 'media',
  storage_path text not null unique,           -- '<workspace_id>/<uuid>.<ext>'
  file_name text not null,
  mime_type text not null,
  kind public.media_kind not null,
  size_bytes bigint not null check (size_bytes > 0),
  width integer,
  height integer,
  duration_seconds numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_path_in_workspace check (split_part(storage_path, '/', 1) = workspace_id::text)
);
create index media_assets_ws_idx on public.media_assets (workspace_id, created_at desc);

-- ---------- Posts ----------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  title text not null default '',
  caption text not null default '',
  format public.post_format not null default 'post',
  status public.post_status not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  timezone text not null default 'UTC',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_requires_time check (status <> 'scheduled' or scheduled_at is not null)
);
create index posts_ws_status_idx on public.posts (workspace_id, status);
create index posts_ws_scheduled_idx on public.posts (workspace_id, scheduled_at);
create index posts_ws_created_idx on public.posts (workspace_id, created_at desc);
create index posts_caption_search_idx on public.posts using gin (to_tsvector('simple', title || ' ' || caption));

create table public.post_targets (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  platform public.platform not null,
  social_account_id uuid references public.social_accounts (id) on delete set null,
  caption_override text,
  status public.target_status not null default 'pending',
  external_post_id text,
  external_url text,
  last_error text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, platform)
);
create index post_targets_ws_idx on public.post_targets (workspace_id);
create index post_targets_status_idx on public.post_targets (status);
create index post_targets_platform_idx on public.post_targets (platform);

create table public.post_media (
  post_id uuid not null references public.posts (id) on delete cascade,
  media_id uuid not null references public.media_assets (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  position smallint not null default 0,
  primary key (post_id, media_id)
);
create index post_media_ws_idx on public.post_media (workspace_id);

-- ---------- Scheduling ----------
-- Durable record of every publish job. The queue (BullMQ) is an execution
-- mechanism; this table is the source of truth the worker reconciles against.
create table public.scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  run_at timestamptz not null,
  status public.job_status not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  queue_job_id text,
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scheduled_jobs_ws_idx on public.scheduled_jobs (workspace_id);
create index scheduled_jobs_due_idx on public.scheduled_jobs (status, run_at);
create index scheduled_jobs_post_idx on public.scheduled_jobs (post_id);
-- At most one live job per post: rescheduling cancels the old one first.
create unique index scheduled_jobs_one_active_per_post on public.scheduled_jobs (post_id) where status in ('queued', 'processing', 'retrying');

create table public.publishing_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.scheduled_jobs (id) on delete set null,
  post_target_id uuid not null references public.post_targets (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  attempt_number integer not null,
  status public.target_status not null,
  error_code text,
  error_message text,
  provider_status integer,
  external_post_id text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index publishing_attempts_ws_idx on public.publishing_attempts (workspace_id, created_at desc);
create index publishing_attempts_target_idx on public.publishing_attempts (post_target_id);

-- ---------- Inbox ----------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  social_account_id uuid references public.social_accounts (id) on delete set null,
  platform public.platform not null,
  external_thread_id text not null,
  participant_name text not null,
  participant_handle text,
  participant_avatar_url text,
  last_message_preview text,
  last_message_at timestamptz,
  unread_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, platform, external_thread_id)
);
create index conversations_ws_idx on public.conversations (workspace_id, last_message_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  direction public.message_direction not null,
  body text not null,
  external_message_id text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, sent_at);

-- ---------- Analytics ----------
create table public.analytics_daily (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  platform public.platform not null,
  date date not null,
  reach integer, impressions integer, engagement integer, likes integer, comments integer,
  shares integer, clicks integer, followers integer,
  source public.metric_source not null default 'live',
  fetched_at timestamptz not null default now(),
  unique (social_account_id, date)
);
create index analytics_daily_ws_date_idx on public.analytics_daily (workspace_id, date);

create table public.analytics_post (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  post_target_id uuid not null unique references public.post_targets (id) on delete cascade,
  platform public.platform not null,
  reach integer, impressions integer, likes integer, comments integer, shares integer, clicks integer,
  engagement_rate numeric(6, 3),
  source public.metric_source not null default 'live',
  fetched_at timestamptz not null default now()
);
create index analytics_post_ws_idx on public.analytics_post (workspace_id);

-- ---------- Notifications ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,        -- post_published | post_failed | oauth_expired | schedule_upcoming | inbox_message | ai_limit | subscription | invitation
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);

-- ---------- AI ----------
create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  prompt text not null,
  output text not null,
  model text not null,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz not null default now()
);
create index ai_generations_ws_idx on public.ai_generations (workspace_id, created_at desc);

-- ---------- Developer API ----------
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  name text not null,
  prefix text not null,                 -- first chars shown in UI, e.g. 'kr_live_8f2c'
  key_hash text not null unique,        -- sha256 of the full key; the key itself is never stored
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index api_keys_ws_idx on public.api_keys (workspace_id);

-- ---------- Billing ----------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  plan_id text not null references public.plans (id),
  status public.subscription_status not null default 'active',
  provider text,                        -- 'stripe' once billing is enabled
  provider_customer_id text,
  provider_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period_start date not null,
  metric text not null,                 -- posts | ai_generations | api_requests
  count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (workspace_id, period_start, metric)
);

-- ---------- Logs & events ----------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete set null,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,                 -- e.g. post.scheduled, member.role_changed, api_key.revoked
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index audit_logs_ws_idx on public.audit_logs (workspace_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

create table public.system_logs (
  id uuid primary key default gen_random_uuid(),
  level public.log_level not null,
  event text not null,
  message text,
  user_id uuid,
  workspace_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index system_logs_created_idx on public.system_logs (created_at desc);
create index system_logs_level_idx on public.system_logs (level, created_at desc);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.platform not null,
  external_event_id text not null,
  payload jsonb not null,
  signature_valid boolean not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, external_event_id)   -- idempotency: duplicate deliveries are ignored
);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array[
    'plans','profiles','workspaces','workspace_members','workspace_invitations','social_accounts','oauth_tokens',
    'media_assets','posts','post_targets','scheduled_jobs','conversations','subscriptions'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------- Seed reference data ----------
insert into public.plans (id, name, price_cents, sort_order, limits) values
  ('free',     'Free',        0, 0, '{"posts_per_month":30,"social_accounts":3,"members":1,"ai_generations":20,"api_requests":0}'),
  ('starter',  'Starter',  1200, 1, '{"posts_per_month":null,"social_accounts":8,"members":3,"ai_generations":200,"api_requests":1000}'),
  ('pro',      'Pro',      2900, 2, '{"posts_per_month":null,"social_accounts":15,"members":10,"ai_generations":2000,"api_requests":20000}'),
  ('business', 'Business', 9900, 3, '{"posts_per_month":null,"social_accounts":50,"members":50,"ai_generations":10000,"api_requests":200000}');

insert into public.roles (key, name, description, rank) values
  ('owner',  'Owner',  'Billing, workspace and member management, accounts, publishing', 50),
  ('admin',  'Admin',  'Everything except billing and deleting the workspace', 40),
  ('editor', 'Editor', 'Create, edit, schedule and publish posts', 30),
  ('member', 'Member', 'Create drafts and upload media', 20),
  ('viewer', 'Viewer', 'Read-only access', 10);

insert into public.feature_flags (key, enabled, description) values
  ('ENABLE_TIKTOK', true, 'TikTok integration'),
  ('ENABLE_AI_STUDIO', true, 'AI Studio and AI assistant'),
  ('ENABLE_ANALYTICS', true, 'Analytics pages'),
  ('ENABLE_INBOX', true, 'Unified inbox'),
  ('ENABLE_API', false, 'Public developer API');
