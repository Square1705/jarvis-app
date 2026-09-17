-- Soporta: bot de Telegram, resumen diario, memoria de patrones,
-- proyección de negocios, check-in diario, y deja lista la estructura
-- para Google Calendar. Pega esto en Supabase -> SQL Editor -> Run.

-- Negocios: precio promedio de venta (para proyectar ingreso potencial)
-- y bandera para no repetir la alerta de "se acabó el stock".
alter table public.negocios
  add column if not exists precio_promedio numeric not null default 0,
  add column if not exists stock_zero_notified boolean not null default false;

-- Pendientes: cuándo se creó (para detectar "sin fecha hace más de 3 días")
-- y cuándo se avisó por última vez por Telegram (para no repetir spam).
alter table public.todos
  add column if not exists notified_at timestamptz;

-- Bitácora de acciones, para que Claude pueda analizar patrones semanales.
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Check-in diario de ánimo (escala 1-5), uno por día.
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null default current_date,
  mood smallint not null check (mood between 1 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, fecha)
);

-- Análisis semanal generado por Claude (cache, para no regenerar en cada visita).
create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fin date not null,
  contenido text not null,
  created_at timestamptz not null default now()
);

-- Placeholder para integración futura con Google Calendar: estructura lista,
-- sin poblar todavía. linked_todo_id permite cruzar un evento con un pendiente.
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'google_calendar',
  external_id text,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz,
  linked_todo_id uuid references public.todos(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;
alter table public.checkins enable row level security;
alter table public.insights enable row level security;
alter table public.calendar_events enable row level security;

create policy "activity_select_own" on public.activity_log for select using (auth.uid() = user_id);
create policy "activity_insert_own" on public.activity_log for insert with check (auth.uid() = user_id);

create policy "checkins_select_own" on public.checkins for select using (auth.uid() = user_id);
create policy "checkins_insert_own" on public.checkins for insert with check (auth.uid() = user_id);
create policy "checkins_update_own" on public.checkins for update using (auth.uid() = user_id);

create policy "insights_select_own" on public.insights for select using (auth.uid() = user_id);
create policy "insights_insert_own" on public.insights for insert with check (auth.uid() = user_id);

create policy "calendar_select_own" on public.calendar_events for select using (auth.uid() = user_id);
create policy "calendar_insert_own" on public.calendar_events for insert with check (auth.uid() = user_id);
create policy "calendar_update_own" on public.calendar_events for update using (auth.uid() = user_id);
create policy "calendar_delete_own" on public.calendar_events for delete using (auth.uid() = user_id);
