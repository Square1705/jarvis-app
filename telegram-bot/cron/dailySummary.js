import { loadState, todayStr } from '../lib/brain.js'
import { getSupabase } from '../lib/supabase.js'
import { sendMessage } from '../lib/telegram.js'

export async function runDailySummary() {
  const supabase = getSupabase()
  const userId = process.env.JARVIS_USER_ID
  const state = await loadState(userId)
  const today = todayStr()

  const pendHoy = state.todos.filter((t) => !t.done && t.dueDate === today)
  const vencidos = state.todos.filter((t) => !t.done && t.dueDate && t.dueDate < today)

  const confirmados = state.finanzas.movimientos.filter((m) => m.confirmado)
  const proyectados = state.finanzas.movimientos.filter((m) => !m.confirmado)
  const saldo =
    confirmados.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0) -
    confirmados.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0)
  const netoProy = proyectados.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0)

  const lines = ['☀️ Buenos días, Gonzalo — resumen de hoy:', '']

  lines.push(`📌 Pendientes hoy: ${pendHoy.length}`)
  pendHoy.forEach((t) => lines.push(`   • ${t.text}`))

  lines.push(`⚠️ Vencidos: ${vencidos.length}`)
  vencidos.forEach((t) => lines.push(`   • ${t.text}`))

  lines.push(
    `💰 Saldo confirmado: S/ ${saldo.toFixed(0)}${proyectados.length ? ` (proyectado: S/ ${(saldo + netoProy).toFixed(0)})` : ''}`,
  )
  lines.push(`🕶️ Stock Ray-Ban: ${state.negocios.rayban.stock} | 📱 iPhones: ${state.negocios.iphone.stock}`)

  const { data: lastMsg } = await supabase
    .from('chat_messages')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lastMsg) {
    const daysSince = (Date.now() - new Date(lastMsg.created_at).getTime()) / (1000 * 60 * 60 * 24)
    if (daysSince > 2) {
      lines.push('', `👋 Ya van ${Math.floor(daysSince)} días sin que abras la app. ¿Todo bien?`)
    }
  }

  await sendMessage(lines.join('\n'))
}
