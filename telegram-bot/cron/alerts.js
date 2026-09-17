import { getSupabase } from '../lib/supabase.js'
import { sendMessage } from '../lib/telegram.js'
import { todayStr, addDays } from '../lib/brain.js'

const PRODUCT_LABELS = { rayban: 'Ray-Ban Cámara', iphone: 'iPhones' }

// Corre cada pocas horas: avisa pendientes vencidos/por vencer en 48h que
// no se hayan notificado en las últimas ~20h (para no repetir spam), y
// avisa una sola vez cuando el stock de un producto llega a 0.
export async function runAlertsCheck() {
  const supabase = getSupabase()
  const userId = process.env.JARVIS_USER_ID
  const today = todayStr()
  const limite48h = addDays(today, 2)

  const { data: todos } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    .eq('done', false)
    .not('due_date', 'is', null)
    .lte('due_date', limite48h)

  const paraAvisar = (todos || []).filter((t) => {
    if (!t.notified_at) return true
    const hoursSince = (Date.now() - new Date(t.notified_at).getTime()) / (1000 * 60 * 60)
    return hoursSince > 20
  })

  if (paraAvisar.length > 0) {
    const lines = ['⏰ Pendientes por vencer o vencidos:', '']
    for (const t of paraAvisar) {
      const status = t.due_date < today ? 'VENCIDO' : t.due_date === today ? 'HOY' : 'pronto'
      lines.push(`• [${status}] ${t.text} (${t.due_date})`)
    }
    await sendMessage(lines.join('\n'))
    await supabase
      .from('todos')
      .update({ notified_at: new Date().toISOString() })
      .in(
        'id',
        paraAvisar.map((t) => t.id),
      )
  }

  const { data: negocios } = await supabase.from('negocios').select('*').eq('user_id', userId)
  for (const n of negocios || []) {
    if (Number(n.stock) === 0 && !n.stock_zero_notified) {
      await sendMessage(`🚨 Se acabó el stock de ${PRODUCT_LABELS[n.producto] || n.producto}.`)
      await supabase
        .from('negocios')
        .update({ stock_zero_notified: true })
        .eq('user_id', userId)
        .eq('producto', n.producto)
    }
  }
}
