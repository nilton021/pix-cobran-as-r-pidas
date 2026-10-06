-- Reconciliação automática de cobranças Pix.
-- A URL pública do app e o segredo ficam no Supabase Vault; nenhum segredo é versionado.
create extension if not exists vault with schema vault;
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'pix-charge-reconciliation',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'pix_app_url') || '/api/public/reconcile-charges',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'pix_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    ) as request_id;
  $$
)
where not exists (
  select 1 from cron.job where jobname = 'pix-charge-reconciliation'
);
