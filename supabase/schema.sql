-- Schema para JARVIS. Pega esto completo en Supabase -> SQL Editor -> Run.
-- Crea las tablas de pendientes, negocios, movimientos y chat, todas
-- protegidas con Row Level Security: cada usuario solo puede ver/editar
-- sus propias filas (auth.uid() = user_id).

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  area text not null check (area in ('trabajo','negocios','personal','finanzas')),
  text text not null,
  priority text not null default 'media' check (priority in ('alta','media','baja')),
  due_date date,
  done boolean not null default false,
  -- última vez que se avisó por Telegram que este pendiente venció o está
  -- por vencer, para no repetir la misma alerta una y otra vez.
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.negocios (
  user_id uuid not null references auth.users(id) on delete cascade,
  producto text not null check (producto in ('rayban','iphone')),
  stock numeric not null default 0,
  por_cobrar numeric not null default 0,
  -- precio de venta promedio, usado para proyectar el ingreso potencial
  -- del stock actual (stock * precio_promedio).
  precio_promedio numeric not null default 0,
  -- evita repetir la alerta de "se acabó el stock" en cada chequeo.
  stock_zero_notified boolean not null default false,
  primary key (user_id, producto)
);

create table if not exists public.movimientos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('ingreso','gasto')),
  monto numeric not null,
  concepto text not null,
  categoria text not null default 'otros',
  fecha date not null default current_date,
  -- true = el dinero ya se movió de verdad; false = es una proyección /
  -- plan a futuro (ej: "probablemente gaste X mañana") que todavía no cuenta
  -- como saldo real. Ver supabase/migrations/002_movimientos_confirmado.sql
  -- para instalaciones existentes.
  confirmado boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content jsonb not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- Bitácora de acciones (crear pendiente, gasto registrado, venta, etc.)
-- para que Claude pueda analizar patrones semanales.
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

-- Análisis semanal generado por Claude (cache).
create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fin date not null,
  contenido text not null,
  created_at timestamptz not null default now()
);

-- Perfil acumulado (memoria narrativa): una fila por usuario, se actualiza
-- (no se acumula como historial) cada vez que se regeneran los Insights.
-- Se inyecta en cada conversación como memoria de largo plazo.
create table if not exists public.jarvis_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resumen text not null default '',
  updated_at timestamptz not null default now()
);

-- Placeholder para integración futura con Google Calendar.
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

alter table public.todos enable row level security;
alter table public.negocios enable row level security;
alter table public.movimientos enable row level security;
alter table public.chat_messages enable row level security;
alter table public.activity_log enable row level security;
alter table public.checkins enable row level security;
alter table public.insights enable row level security;
alter table public.calendar_events enable row level security;

create policy "todos_select_own" on public.todos for select using (auth.uid() = user_id);
create policy "todos_insert_own" on public.todos for insert with check (auth.uid() = user_id);
create policy "todos_update_own" on public.todos for update using (auth.uid() = user_id);
create policy "todos_delete_own" on public.todos for delete using (auth.uid() = user_id);

create policy "negocios_select_own" on public.negocios for select using (auth.uid() = user_id);
create policy "negocios_upsert_own" on public.negocios for insert with check (auth.uid() = user_id);
create policy "negocios_update_own" on public.negocios for update using (auth.uid() = user_id);

create policy "movimientos_select_own" on public.movimientos for select using (auth.uid() = user_id);
create policy "movimientos_insert_own" on public.movimientos for insert with check (auth.uid() = user_id);
create policy "movimientos_update_own" on public.movimientos for update using (auth.uid() = user_id);
create policy "movimientos_delete_own" on public.movimientos for delete using (auth.uid() = user_id);

create policy "chat_select_own" on public.chat_messages for select using (auth.uid() = user_id);
create policy "chat_insert_own" on public.chat_messages for insert with check (auth.uid() = user_id);

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

alter table public.jarvis_profile enable row level security;
create policy "profile_select_own" on public.jarvis_profile for select using (auth.uid() = user_id);
create policy "profile_upsert_own" on public.jarvis_profile for insert with check (auth.uid() = user_id);
create policy "profile_update_own" on public.jarvis_profile for update using (auth.uid() = user_id);
