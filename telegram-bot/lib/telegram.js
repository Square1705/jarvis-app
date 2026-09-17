import { Bot } from 'node-telegram-bot-api'

let botInstance = null

export function getBot() {
  if (!botInstance) {
    botInstance = new Bot(process.env.TELEGRAM_BOT_TOKEN)
  }
  return botInstance
}

export async function sendMessage(text) {
  const bot = getBot()
  await bot.api.sendMessage({ chat_id: Number(process.env.TELEGRAM_CHAT_ID), text })
}
