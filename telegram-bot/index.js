import 'dotenv/config'
import { schedule } from 'node-cron'
import { run } from 'node-telegram-bot-api/node'
import { getBot, sendMessage } from './lib/telegram.js'
import { handleIncomingMessage } from './lib/brain.js'
import { runDailySummary } from './cron/dailySummary.js'
import { runAlertsCheck } from './cron/alerts.js'
import { startServer } from './server.js'

const REQUIRED_ENV = [
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'ANTHROPIC_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JARVIS_USER_ID',
]

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Falta la variable de entorno ${key}. Revisa .env / las variables en Railway.`)
    process.exit(1)
  }
}

if (!process.env.WEBHOOK_SECRET) {
  console.warn(
    'WEBHOOK_SECRET no está configurado: /health sigue funcionando, pero los avisos ' +
      'en tiempo real (Supabase Database Webhooks) quedarán rechazados hasta que lo configures.',
  )
}

// Servidor HTTP: /health para monitoreo externo, /webhook/supabase para
// avisos instantáneos (en vez de esperar al cron de 4h).
startServer()

const AUTHORIZED_CHAT_ID = String(process.env.TELEGRAM_CHAT_ID)
const bot = getBot()

// Solo responde al chat_id autorizado (Gonzalo). Cualquier otro chat que
// le escriba a este bot es ignorado por completo — sin esto, cualquiera
// que encuentre el bot en Telegram podría leer/editar los datos de Gonzalo.
bot.on('message', async (ctx) => {
  if (String(ctx.chatId) !== AUTHORIZED_CHAT_ID) return
  const text = ctx.message?.text
  if (!text) return

  try {
    await ctx.api.sendChatAction({ chat_id: ctx.chatId, action: 'typing' })
    const reply = await handleIncomingMessage(text)
    await ctx.reply(reply)
  } catch (err) {
    console.error('Error procesando mensaje de Telegram:', err)
    await ctx.reply('Tuve un problema procesando eso. Intenta de nuevo en un momento.')
  }
})

bot.catch((err) => {
  console.error('Error no manejado en el bot:', err)
})

// Resumen diario a la hora configurada (default 8am), hora de Lima.
const summaryHour = Number(process.env.DAILY_SUMMARY_HOUR || 8)
schedule(
  `0 ${summaryHour} * * *`,
  () => {
    runDailySummary().catch((err) => console.error('Error en resumen diario:', err))
  },
  { timezone: 'America/Lima' },
)

// Chequeo de vencidos/48h/stock=0 cada 4 horas.
schedule(
  '0 */4 * * *',
  () => {
    runAlertsCheck().catch((err) => console.error('Error en chequeo de alertas:', err))
  },
  { timezone: 'America/Lima' },
)

console.log('JARVIS Telegram bot iniciando...')
sendMessage('🤖 JARVIS bot conectado y escuchando.').catch((err) =>
  console.error('No se pudo enviar el mensaje de arranque:', err),
)

try {
  await run(bot)
} catch (err) {
  console.error('El bot se detuvo por un error de conexión con Telegram:', err?.message || err)
  console.error('Revisa que TELEGRAM_BOT_TOKEN sea correcto (te lo da @BotFather).')
  process.exit(1)
}
