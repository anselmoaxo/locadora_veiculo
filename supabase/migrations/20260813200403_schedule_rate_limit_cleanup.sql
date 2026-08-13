-- Remove expired rate-limit buckets daily. The existence check keeps the
-- migration safe when environments already contain the operational job.
select cron.schedule(
  'purge-expired-edge-rate-limits',
  '17 3 * * *',
  $$select private.purge_rate_limit_counters(interval '2 days');$$
)
where not exists (
  select 1
  from cron.job
  where jobname = 'purge-expired-edge-rate-limits'
);
