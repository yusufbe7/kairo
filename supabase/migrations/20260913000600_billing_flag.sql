-- =====================================================================
-- Kairo — an admin switch for the paywall
--
-- The paywall is on by default. While the rest of the product is still being
-- tested end to end it can be turned off from /admin/flags, so a real account
-- can walk the whole app without a Stripe subscription. Only the service role
-- may write feature_flags (see the grants in …000200_auth_and_rls.sql), and
-- only a super admin reaches the page that does it.
-- =====================================================================

insert into public.feature_flags (key, enabled, description) values
  ('ENFORCE_BILLING', true, 'Require an active Stripe subscription to use the dashboard. Turn off only while testing.')
on conflict (key) do nothing;
