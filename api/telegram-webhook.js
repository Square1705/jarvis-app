import { handleIncomingMessage } from '../server/telegramBrain.js'
import { sendTelegramMessage, sendTelegramChatAction } from '../server/telegram.js'

// Telegram llama acá cada vez que Gonzalo le escribe al bot (webhook, no
// polling — así no necesitamos un servidor persistente).
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const secret = req.headers['x-telegram-bot-api-secret-token']
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  const update = req.body || {}
  const message = update.message
  const chatId = message?.chat?.id
  const text = message?.text

  // Solo respondemos al chat_id autorizado y a mensajes de texto. Cualquier
  // otra cosa (otro chat, stickers, fotos) se ignora silenciosamente pero
  // igual devolvemos 200 para que Telegram no reintente la entrega.
  if (!chatId || String(chatId) !== String(process.env.TELEGRAM_CHAT_ID) || !text) {
    res.status(200).json({ ok: true })
    return
  }

  try {
    await sendTelegramChatAction('typing', chatId)
    const reply = await handleIncomingMessage(text)
    await sendTelegramMessage(reply, chatId)
  } catch (err) {
    console.error('Error procesando mensaje de Telegram:', err)
    await sendTelegramMessage(
      'Tuve un problema procesando eso. Intenta de nuevo en un momento.',
      chatId,
    ).catch(() => {})
  }

  res.status(200).json({ ok: true })
}
