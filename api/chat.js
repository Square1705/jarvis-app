import Anthropic from '@anthropic-ai/sdk'

// Server-side only: ANTHROPIC_API_KEY (sin prefijo VITE_) nunca llega al
// bundle del navegador. Esta función es el único lugar que la usa.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const MODEL_ID = 'claude-sonnet-4-6'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'Falta configurar ANTHROPIC_API_KEY en el servidor.' })
    return
  }

  const { system, tools, messages } = req.body || {}

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'El campo "messages" es requerido.' })
    return
  }

  try {
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: 4096,
      system,
      tools,
      messages,
    })
    res.status(200).json(response)
  } catch (err) {
    const status = err?.status && Number.isInteger(err.status) ? err.status : 500
    res.status(status).json({ error: err?.message || 'Error llamando a Claude.' })
  }
}
