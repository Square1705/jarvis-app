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
  created_at timestamptz not null default now()
);

create table if not exists public.negocios (
  user_id uuid not null references auth.users(id) on delete cascade,
  producto text not null check (producto in ('rayban','iphone')),
  stock numeric not null default 0,
  por_cobrar numeric not null default 0,
  primary key (user_id, producto)
);

create table if not exists public.movimientos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('ingreso','gasto')),
  monto numeric not null,
  concepto text not null,
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

alter table public.todos enable row level security;
alter table public.negocios enable row level security;
alter table public.movimientos enable row level security;
alter table public.chat_messages enable row level security;

create policy "todos_select_own" on public.todos for select using (auth.uid() = user_id);
create policy "todos_insert_own" on public.todos for insert with check (auth.uid() = user_id);
create policy "todos_update_own" on public.todos for update using (auth.uid() = user_id);
create policy "todos_delete_own" on public.todos for delete using (auth.uid() = user_id);

create policy "negocios_select_own" on public.negocios for select using (auth.uid() = user_id);
create policy "negocios_upsert_own" on public.negocios for insert with check (auth.uid() = user_id);
create policy "negocios_update_own" on public.negocios for update using (auth.uid() = user_id);

create policy "movimientos_select_own" on public.movimientos for select using (auth.uid() = user_id);
create policy "movimientos_insert_own" on public.movimientos for insert with check (auth.uid() = user_id);
create policy "movimientos_delete_own" on public.movimientos for delete using (auth.uid() = user_id);

create policy "chat_select_own" on public.chat_messages for select using (auth.uid() = user_id);
create policy "chat_insert_own" on public.chat_messages for insert with check (auth.uid() = user_id);
