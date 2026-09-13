-- =====================================================================
-- Kairo — authorization helpers, signup trigger, RPCs and RLS
-- Every tenant table is protected by Row Level Security. The service role
-- (server only) bypasses RLS for workers, OAuth callbacks and admin paths.
-- =====================================================================

-- ---------- Authorization helpers (security definer so RLS on members doesn't recurse) ----------
create or replace function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = auth.uid());
$$;

create or replace function public.has_role(ws uuid, min_role public.workspace_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.workspace_members m
    join public.roles r on r.key = m.role
    join public.roles needed on needed.key = min_role
    where m.workspace_id = ws and m.user_id = auth.uid() and r.rank >= needed.rank
  );
$$;

create or replace function public.shares_workspace_with(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members a
    join public.workspace_members b on a.workspace_id = b.workspace_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.make_slug(base text) returns text
language sql volatile set search_path = '' as $$
  select coalesce(nullif(trim(both '-' from lower(regexp_replace(base, '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'workspace')
         || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
$$;

create or replace function public.valid_timezone(tz text) returns text
language sql stable set search_path = '' as $$
  select coalesce((select name from pg_catalog.pg_timezone_names where name = tz limit 1), 'UTC');
$$;

-- Rows may never move between workspaces.
create or replace function public.prevent_workspace_change() returns trigger
language plpgsql as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'workspace_id is immutable' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['posts','post_targets','post_media','media_assets','social_accounts','conversations','messages','scheduled_jobs'] loop
    execute format('create trigger lock_workspace before update on public.%I for each row execute function public.prevent_workspace_change()', t);
  end loop;
end $$;

-- ---------- Signup: profile + personal workspace ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws_id uuid;
  display text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, email, full_name) values (new.id, new.email, display);

  insert into public.workspaces (name, slug, owner_id, timezone)
  values (left(display || '''s workspace', 80), public.make_slug(display), new.id, public.valid_timezone(new.raw_user_meta_data ->> 'timezone'))
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role) values (ws_id, new.id, 'owner');
  insert into public.subscriptions (workspace_id, plan_id, status) values (ws_id, 'free', 'active');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RPCs ----------
create or replace function public.create_workspace(p_name text, p_timezone text default 'UTC') returns uuid
language plpgsql security definer set search_path = '' as $$
declare ws_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if (select count(*) from public.workspaces where owner_id = auth.uid()) >= 10 then
    raise exception 'workspace limit reached' using errcode = 'P0001';
  end if;
  insert into public.workspaces (name, slug, owner_id, timezone)
  values (p_name, public.make_slug(p_name), auth.uid(), public.valid_timezone(p_timezone))
  returning id into ws_id;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws_id, auth.uid(), 'owner');
  insert into public.subscriptions (workspace_id, plan_id, status) values (ws_id, 'free', 'active');
  insert into public.audit_logs (workspace_id, actor_id, action, target_type, target_id)
  values (ws_id, auth.uid(), 'workspace.created', 'workspace', ws_id::text);
  return ws_id;
end $$;

create or replace function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  inv public.workspace_invitations;
  user_email text := (select email from auth.users where id = auth.uid());
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select * into inv from public.workspace_invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and status = 'pending'
  for update;
  if inv.id is null then raise exception 'invitation not found' using errcode = 'P0002'; end if;
  if inv.expires_at < now() then
    update public.workspace_invitations set status = 'expired' where id = inv.id;
    raise exception 'invitation expired' using errcode = 'P0001';
  end if;
  if lower(inv.email::text) <> lower(user_email) then
    raise exception 'invitation was sent to a different email' using errcode = '42501';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role) values (inv.workspace_id, auth.uid(), inv.role)
  on conflict (workspace_id, user_id) do nothing;
  update public.workspace_invitations set status = 'accepted' where id = inv.id;
  insert into public.audit_logs (workspace_id, actor_id, action, target_type, target_id)
  values (inv.workspace_id, auth.uid(), 'member.joined', 'invitation', inv.id::text);
  return inv.workspace_id;
end $$;

-- ---------- Privileges ----------
-- Supabase grants broad table privileges by default; narrow them, then let RLS decide rows.
revoke all on all tables in schema public from anon;
revoke all on function public.create_workspace(text, text) from anon, public;
revoke all on function public.accept_invitation(text) from anon, public;
grant execute on function public.create_workspace(text, text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

-- Server-only tables.
revoke all on public.oauth_tokens, public.system_logs, public.webhook_events, public.system_settings from authenticated;

-- Written only by server services (service role) after permission checks.
revoke insert, update, delete on public.scheduled_jobs, public.publishing_attempts, public.analytics_daily,
  public.analytics_post, public.subscriptions, public.usage, public.audit_logs, public.plans, public.roles,
  public.feature_flags, public.api_keys, public.workspace_invitations from authenticated;
revoke insert, update on public.social_accounts from authenticated;
revoke insert, delete on public.profiles, public.workspaces from authenticated;
revoke insert on public.ai_generations, public.notifications from authenticated;

-- Column-level update rights: users can't grant themselves super admin, change plans, etc.
revoke update on public.profiles, public.workspaces from authenticated;
grant update (full_name, avatar_url, job_title, locale, notification_prefs, last_active_at) on public.profiles to authenticated;
grant update (name, timezone) on public.workspaces to authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
revoke update on public.conversations from authenticated;
grant update (unread_count) on public.conversations to authenticated;

-- ---------- Enable RLS everywhere ----------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- Policies ----------
-- Reference data
create policy plans_read on public.plans for select to authenticated using (true);
create policy roles_read on public.roles for select to authenticated using (true);
create policy flags_read on public.feature_flags for select to authenticated using (true);

-- Profiles
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_workspace_with(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Workspaces
create policy workspaces_read on public.workspaces for select to authenticated using (public.is_member(id));
create policy workspaces_update on public.workspaces for update to authenticated
  using (public.has_role(id, 'admin')) with check (public.has_role(id, 'admin'));

-- Members (owner row is protected: only the service layer transfers ownership)
create policy members_read on public.workspace_members for select to authenticated using (public.is_member(workspace_id));
create policy members_insert on public.workspace_members for insert to authenticated
  with check (public.has_role(workspace_id, 'admin') and role <> 'owner');
create policy members_update on public.workspace_members for update to authenticated
  using (public.has_role(workspace_id, 'admin') and role <> 'owner')
  with check (public.has_role(workspace_id, 'admin') and role <> 'owner');
create policy members_delete on public.workspace_members for delete to authenticated
  using ((public.has_role(workspace_id, 'admin') and role <> 'owner') or (user_id = auth.uid() and role <> 'owner'));

create policy invitations_read on public.workspace_invitations for select to authenticated using (public.has_role(workspace_id, 'admin'));

-- Social accounts: rows are created by the OAuth callback (service role); users may read and disconnect.
create policy social_read on public.social_accounts for select to authenticated using (public.is_member(workspace_id));
create policy social_delete on public.social_accounts for delete to authenticated using (public.has_role(workspace_id, 'admin'));

-- Media
create policy media_read on public.media_assets for select to authenticated using (public.is_member(workspace_id));
create policy media_insert on public.media_assets for insert to authenticated
  with check (public.has_role(workspace_id, 'member') and uploaded_by = auth.uid());
create policy media_update on public.media_assets for update to authenticated
  using (public.has_role(workspace_id, 'editor') or uploaded_by = auth.uid());
create policy media_delete on public.media_assets for delete to authenticated
  using (public.has_role(workspace_id, 'editor') or (uploaded_by = auth.uid() and public.has_role(workspace_id, 'member')));

-- Posts: members write drafts; only editors+ may schedule or touch non-drafts.
create policy posts_read on public.posts for select to authenticated using (public.is_member(workspace_id));
create policy posts_insert on public.posts for insert to authenticated
  with check (public.has_role(workspace_id, 'member') and author_id = auth.uid()
              and (status = 'draft' or public.has_role(workspace_id, 'editor')));
create policy posts_update on public.posts for update to authenticated
  using (public.has_role(workspace_id, 'editor') or (author_id = auth.uid() and status = 'draft' and public.has_role(workspace_id, 'member')))
  with check (status = 'draft' or public.has_role(workspace_id, 'editor'));
create policy posts_delete on public.posts for delete to authenticated
  using (public.has_role(workspace_id, 'editor') or (author_id = auth.uid() and status = 'draft' and public.has_role(workspace_id, 'member')));

create policy targets_read on public.post_targets for select to authenticated using (public.is_member(workspace_id));
create policy targets_write on public.post_targets for all to authenticated
  using (public.has_role(workspace_id, 'member'))
  with check (
    public.has_role(workspace_id, 'member')
    and exists (select 1 from public.posts p where p.id = post_id and p.workspace_id = post_targets.workspace_id)
    and (social_account_id is null or exists (select 1 from public.social_accounts s where s.id = social_account_id and s.workspace_id = post_targets.workspace_id))
  );

create policy post_media_read on public.post_media for select to authenticated using (public.is_member(workspace_id));
create policy post_media_write on public.post_media for all to authenticated
  using (public.has_role(workspace_id, 'member'))
  with check (
    public.has_role(workspace_id, 'member')
    and exists (select 1 from public.posts p where p.id = post_id and p.workspace_id = post_media.workspace_id)
    and exists (select 1 from public.media_assets m where m.id = media_id and m.workspace_id = post_media.workspace_id)
  );

-- Jobs & attempts: read-only for members
create policy jobs_read on public.scheduled_jobs for select to authenticated using (public.is_member(workspace_id));
create policy attempts_read on public.publishing_attempts for select to authenticated using (public.is_member(workspace_id));

-- Inbox
create policy conversations_read on public.conversations for select to authenticated using (public.is_member(workspace_id));
create policy conversations_mark_read on public.conversations for update to authenticated
  using (public.has_role(workspace_id, 'member')) with check (public.has_role(workspace_id, 'member'));
create policy messages_read on public.messages for select to authenticated using (public.is_member(workspace_id));

-- Analytics
create policy analytics_daily_read on public.analytics_daily for select to authenticated using (public.is_member(workspace_id));
create policy analytics_post_read on public.analytics_post for select to authenticated using (public.is_member(workspace_id));

-- Notifications: personal
create policy notifications_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- AI, API keys, billing, audit
create policy ai_read on public.ai_generations for select to authenticated using (public.is_member(workspace_id));
create policy api_keys_read on public.api_keys for select to authenticated using (public.has_role(workspace_id, 'admin'));
create policy subscriptions_read on public.subscriptions for select to authenticated using (public.is_member(workspace_id));
create policy usage_read on public.usage for select to authenticated using (public.is_member(workspace_id));
create policy audit_read on public.audit_logs for select to authenticated using (workspace_id is not null and public.has_role(workspace_id, 'admin'));
