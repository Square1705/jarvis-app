import { sendTelegramMessage } from '../server/telegram.js'

const PRODUCT_LABELS = { rayban: 'Ray-Ban Cámara', iphone: 'iPhones' }

// Reacciona a un evento de Supabase Database Webhooks en tiempo real (en
// vez de esperar al cron diario). El payload ya trae la fila completa, no
// hace falta re-consultar Supabase.
async function handleSupabaseEvent({ type, table, record }) {
  if (!record) return

  if (table === 'negocios' && type === 'UPDATE' && Number(record.stock) === 0 && !record.stock_zero_notified) {
    await sendTelegramMessage(`🚨 Se acabó el stock de ${PRODUCT_LABELS[record.producto] || record.producto}.`)
    return
  }

  if (table === 'todos' && type === 'INSERT' && record.priority === 'alta') {
    await sendTelegramMessage(
      `🔥 Pendiente urgente creado: ${record.text}${record.due_date ? ` (vence ${record.due_date})` : ''}`,
    )
    return
  }

  const umbral = Number(process.env.GASTO_ALERTA_UMBRAL || 300)
  if (
    table === 'movimientos' &&
    type === 'INSERT' &&
    record.tipo === 'gasto' &&
    record.confirmado === true &&
    Number(record.monto) >= umbral
  ) {
    await sendTelegramMessage(`💸 Gasto grande registrado: S/ ${Number(record.monto).toFixed(2)} — ${record.concepto}`)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const secret = req.headers['x-webhook-secret']
  if (!process.env.SUPABASE_WEBHOOK_SECRET || secret !== process.env.SUPABASE_WEBHOOK_SECRET) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const { type, table, record } = req.body || {}

  try {
    await handleSupabaseEvent({ type, table, record })
  } catch (err) {
    console.error('Error procesando webhook de Supabase:', err)
  }

  res.status(200).json({ ok: true })
}
