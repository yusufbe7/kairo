-- Atomic usage counter, callable only by the service role (server-side services).
create or replace function public.increment_usage(p_workspace uuid, p_metric text, p_amount integer default 1)
returns integer language sql security definer set search_path = '' as $$
  insert into public.usage (workspace_id, period_start, metric, count)
  values (p_workspace, date_trunc('month', now())::date, p_metric, p_amount)
  on conflict (workspace_id, period_start, metric)
  do update set count = public.usage.count + excluded.count, updated_at = now()
  returning count;
$$;
revoke all on function public.increment_usage(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.increment_usage(uuid, text, integer) to service_role;
