-- Agrega la distinción entre movimientos confirmados (ya sucedieron) y
-- proyectados (planes/estimaciones a futuro, como "probablemente gaste X
-- mañana"). Las filas existentes quedan como confirmadas por defecto.
-- Pega esto en Supabase -> SQL Editor -> Run.

alter table public.movimientos
  add column if not exists confirmado boolean not null default true;
