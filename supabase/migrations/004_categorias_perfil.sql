-- Agrega categorías a los movimientos (para el dashboard de Finanzas) y una
-- tabla de "perfil" narrativo que se actualiza cada vez que se generan
-- Insights, en vez de quedar como snapshots sueltos. Pega esto en
-- Supabase -> SQL Editor -> Run.

alter table public.movimientos
  add column if not exists categoria text not null default 'otros';

-- Perfil acumulado: una fila por usuario, se actualiza (no se acumula como
-- historial) cada vez que se regeneran los Insights. Se inyecta en cada
-- conversación (web y Telegram) como memoria de largo plazo.
create table if not exists public.jarvis_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resumen text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.jarvis_profile enable row level security;

create policy "profile_select_own" on public.jarvis_profile for select using (auth.uid() = user_id);
create policy "profile_upsert_own" on public.jarvis_profile for insert with check (auth.uid() = user_id);
create policy "profile_update_own" on public.jarvis_profile for update using (auth.uid() = user_id);

-- Bug encontrado de paso: la tabla movimientos nunca tuvo política de UPDATE,
-- así que confirmar_movimiento venía fallando silenciosamente por RLS.
drop policy if exists "movimientos_update_own" on public.movimientos;
create policy "movimientos_update_own" on public.movimientos for update using (auth.uid() = user_id);
