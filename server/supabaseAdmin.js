import { createClient } from '@supabase/supabase-js'

// service_role: solo se usa server-side (funciones de api/), nunca en el
// frontend. Bypasa Row Level Security a propósito — estas funciones ya
// validan por su cuenta (secreto de webhook, chat_id de Telegram, etc.)
// en vez de depender de una sesión de usuario.
let client = null

export function getSupabaseAdmin() {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  }
  return client
}
