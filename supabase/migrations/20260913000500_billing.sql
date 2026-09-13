-- =====================================================================
-- Kairo — paid-only access
--
-- Every workspace needs a Stripe subscription that is `trialing` or `active`.
-- The 'free' plan row is kept, with nothing in it, as the "no plan yet"
-- placeholder: subscriptions.plan_id references plans, so deleting it would
-- break both the foreign key and the signup trigger.
-- =====================================================================

-- ---------- Plans ----------
update public.plans set
  name = 'No plan',
  price_cents = 0,
  sort_order = 0,
  limits = '{"posts_per_month":0,"social_accounts":0,"members":1,"ai_generations":0,"api_requests":0}'::jsonb
where id = 'free';

update public.plans set
  name = 'Starter',
  price_cents = 2900,
  sort_order = 1,
  limits = '{"posts_per_month":null,"social_accounts":10,"members":null,"ai_generations":1000,"api_requests":1000}'::jsonb
where id = 'starter';

update public.plans set
  name = 'Pro',
  price_cents = 4900,
  sort_order = 2,
  limits = '{"posts_per_month":null,"social_accounts":15,"members":null,"ai_generations":1000,"api_requests":20000}'::jsonb
where id = 'pro';

-- Displayed as "Pro Plus"; the id stays 'business' so existing rows keep their foreign key.
update public.plans set
  name = 'Pro Plus',
  price_cents = 9900,
  sort_order = 3,
  limits = '{"posts_per_month":null,"social_accounts":30,"members":null,"ai_generations":2000,"api_requests":200000}'::jsonb
where id = 'business';

-- ---------- New signups start unpaid ----------
-- Identical to the original trigger except the subscription: a new workspace is
-- 'canceled' until Stripe tells us otherwise, so the paywall holds from signup.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  ws_id uuid;
  display text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1));
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, display, nullif(new.raw_user_meta_data ->> 'avatar_url', ''));

  insert into public.workspaces (name, slug, owner_id, timezone)
  values (left(display || '''s workspace', 80), public.make_slug(display), new.id, public.valid_timezone(new.raw_user_meta_data ->> 'timezone'))
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role) values (ws_id, new.id, 'owner');
  insert into public.subscriptions (workspace_id, plan_id, status) values (ws_id, 'free', 'canceled');
  return new;
end $$;

-- Workspaces created later, from the app, start unpaid too.
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
  insert into public.subscriptions (workspace_id, plan_id, status) values (ws_id, 'free', 'canceled');
  insert into public.audit_logs (workspace_id, actor_id, action, target_type, target_id)
  values (ws_id, auth.uid(), 'workspace.created', 'workspace', ws_id::text);
  return ws_id;
end $$;

-- Existing workspaces that never paid are unpaid, not active.
update public.subscriptions set status = 'canceled'
where plan_id = 'free' and provider_subscription_id is null;

-- ---------- Stripe webhooks ----------
-- provider was the social platform enum; Stripe deliveries need to land here too,
-- keeping the (provider, external_event_id) idempotency key.
alter table public.webhook_events alter column provider type text;

-- The webhook handler finds a workspace by its Stripe customer.
create index if not exists subscriptions_provider_customer_idx
  on public.subscriptions (provider_customer_id);
