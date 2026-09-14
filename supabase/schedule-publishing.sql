-- ============================================================================
-- Scheduled publishing, without a server.
--
-- Kairo has no long-lived worker process: `scheduled_jobs` is the source of
-- truth and /api/cron/publish drains it. Something just has to ring that
-- doorbell once a minute, and Postgres can do it itself.
--
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New
-- query), after replacing the two placeholders below. Re-running it is safe.
--
--   YOUR_APP_URL    your deployed site, no trailing slash  (https://kairohub.pro)
--   YOUR_CRON_SECRET the CRON_SECRET you set in Vercel     (openssl rand -hex 32)
--
-- The secret is stored in the job definition, in `cron.job` — a table only the
-- database owner can read. Never paste a real secret into a committed file.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Drop an older copy so this file can be re-run after changing the URL or secret.
select cron.unschedule('kairo-publish')
where exists (select 1 from cron.job where jobname = 'kairo-publish');

select cron.schedule(
  'kairo-publish',
  '* * * * *',
  $job$
  select net.http_post(
    url     := 'YOUR_APP_URL/api/cron/publish',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $job$
);

-- ---------------------------------------------------------------------------
-- Checking on it
-- ---------------------------------------------------------------------------
-- Is the schedule there?
--   select jobname, schedule, active from cron.job where jobname = 'kairo-publish';
--
-- Did the last runs fire? (`status` here is Postgres calling the function, not
-- the HTTP response.)
--   select status, start_time, return_message from cron.job_run_details
--   where jobid = (select jobid from cron.job where jobname = 'kairo-publish')
--   order by start_time desc limit 10;
--
-- What did Kairo answer? A 200 with {"ok":true,...} means the tick ran; 401
-- means the secret does not match CRON_SECRET in Vercel; 503 means CRON_SECRET
-- is not set there at all.
--   select status_code, content, created from net._http_response order by created desc limit 10;
--
-- Turn it off:
--   select cron.unschedule('kairo-publish');
