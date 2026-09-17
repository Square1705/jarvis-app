import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// La "anon key" de Supabase está diseñada para ser pública (va en el bundle
// del navegador) — la protección real vive en las políticas de Row Level
// Security del schema (supabase/schema.sql), no en ocultar esta key.
export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null
