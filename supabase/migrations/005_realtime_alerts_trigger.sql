-- Alternativa al botón "Database Webhooks" del dashboard (que falla con
-- "schema supabase_functions does not exist" — bug conocido de Supabase,
-- sin fix confirmado desde la UI). Esto logra lo mismo llamando a pg_net
-- directo desde un trigger nuestro, sin depender del schema interno roto.
-- Pega esto completo en Supabase -> SQL Editor -> Run.

create or replace function public.jarvis_notify_webhook()
returns trigger
language plpgsql
security definer
as $$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', row_to_json(NEW)
  );

  perform net.http_post(
    url := 'https://jarvis-app-pied-xi.vercel.app/api/webhook-supabase',
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '543bec441c71c49e2734d614c86e4f5f0e2389c86d4a7d18'
    )
  );

  return NEW;
end;
$$;

drop trigger if exists jarvis_negocios_webhook on public.negocios;
create trigger jarvis_negocios_webhook
  after update on public.negocios
  for each row
  execute function public.jarvis_notify_webhook();

drop trigger if exists jarvis_todos_webhook on public.todos;
create trigger jarvis_todos_webhook
  after insert on public.todos
  for each row
  execute function public.jarvis_notify_webhook();

drop trigger if exists jarvis_movimientos_webhook on public.movimientos;
create trigger jarvis_movimientos_webhook
  after insert on public.movimientos
  for each row
  execute function public.jarvis_notify_webhook();
