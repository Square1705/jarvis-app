import express from 'express'
import { sendMessage } from './lib/telegram.js'

const GASTO_ALERTA_UMBRAL = Number(process.env.GASTO_ALERTA_UMBRAL || 300)

const PRODUCT_LABELS = { rayban: 'Ray-Ban Cámara', iphone: 'iPhones' }

// Reacciona a un evento de Supabase Database Webhooks en tiempo real (en
// vez de esperar al cron de cada 4h). No hace falta re-consultar Supabase:
// el payload del webhook ya trae la fila completa.
async function handleSupabaseEvent({ type, table, record }) {
  if (!record) return

  if (table === 'negocios' && type === 'UPDATE' && Number(record.stock) === 0 && !record.stock_zero_notified) {
    await sendMessage(`🚨 Se acabó el stock de ${PRODUCT_LABELS[record.producto] || record.producto}.`)
    return
  }

  if (table === 'todos' && type === 'INSERT' && record.priority === 'alta') {
    await sendMessage(`🔥 Pendiente urgente creado: ${record.text}${record.due_date ? ` (vence ${record.due_date})` : ''}`)
    return
  }

  if (
    table === 'movimientos' &&
    type === 'INSERT' &&
    record.tipo === 'gasto' &&
    record.confirmado === true &&
    Number(record.monto) >= GASTO_ALERTA_UMBRAL
  ) {
    await sendMessage(`💸 Gasto grande registrado: S/ ${Number(record.monto).toFixed(2)} — ${record.concepto}`)
  }
}

export function startServer() {
  const app = express()
  app.use(express.json())

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime_seconds: Math.floor(process.uptime()) })
  })

  app.post('/webhook/supabase', async (req, res) => {
    const secret = req.get('x-webhook-secret')
    if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
      res.status(401).json({ error: 'unauthorized' })
      return
    }

    // Responder rápido y procesar después: Supabase espera una respuesta
    // veloz del webhook, no necesita esperar a que Telegram confirme el envío.
    res.status(200).json({ ok: true })

    const { type, table, record } = req.body || {}
    handleSupabaseEvent({ type, table, record }).catch((err) =>
      console.error('Error procesando webhook de Supabase:', err),
    )
  })

  const port = process.env.PORT || 3000
  app.listen(port, () => {
    console.log(`Servidor HTTP del bot escuchando en el puerto ${port} (/health, /webhook/supabase)`)
  })
}
