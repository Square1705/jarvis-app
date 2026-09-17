import { createClient } from '@supabase/supabase-js'

// Este bot usa la service_role key: corre en un servidor de confianza
// (Railway), nunca se expone a un cliente, y por diseño ignora Row Level
// Security. Por eso cada consulta igual filtra explícitamente por
// user_id — no porque RLS lo exija aquí, sino como cinturón de seguridad
// si algún día este código se reutiliza en otro contexto.
//
// Inicialización perezosa: si se creara al importar el módulo, fallaría
// antes de que el chequeo de variables de entorno en index.js llegue a
// correr (los imports de ES modules se evalúan antes que el resto del
// archivo).
let client = null

export function getSupabase() {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  }
  return client
}
