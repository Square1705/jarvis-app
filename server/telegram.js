// Llamadas directas a la API HTTP de Telegram vía fetch — sin librería,
// porque las funciones serverless no necesitan long-polling, solo mandar
// mensajes puntuales.

const BASE = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

export async function sendTelegramMessage(text, chatId) {
  const chat_id = chatId || process.env.TELEGRAM_CHAT_ID
  const res = await fetch(`${BASE()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Telegram sendMessage falló (${res.status}): ${body}`)
  }
  return res.json()
}

export async function sendTelegramChatAction(action, chatId) {
  const chat_id = chatId || process.env.TELEGRAM_CHAT_ID
  await fetch(`${BASE()}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, action }),
  }).catch(() => {})
}
