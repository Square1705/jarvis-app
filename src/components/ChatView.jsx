import { useEffect, useRef } from 'react'

function extractText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n\n')
    .trim()
}

function ChatView({ messages, loading, error, input, onInputChange, onSubmit }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const visible = messages.filter((m) => !m.hidden)

  return (
    <div className="chat-view">
      <div className="chat" ref={scrollRef}>
        {visible.map((m, i) => {
          if (m.role === 'user' && typeof m.content === 'string') {
            return (
              <div key={i} className="msg msg-user">
                {m.content}
              </div>
            )
          }
          if (m.role === 'assistant') {
            const text = extractText(m.content)
            if (!text) return null
            return (
              <div key={i} className="msg msg-assistant">
                {text}
              </div>
            )
          }
          return null
        })}

        {loading && (
          <div className="thinking" aria-live="polite">
            <span className="thinking-circle" />
            <span className="thinking-label">JARVIS está pensando...</span>
          </div>
        )}

        {error && <div className="msg msg-error">{error}</div>}
      </div>

      <form className="composer" onSubmit={onSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Escríbele a JARVIS..."
          disabled={loading}
          autoComplete="off"
        />
        <button type="submit" disabled={loading || !input.trim()} aria-label="Enviar">
          ➤
        </button>
      </form>
    </div>
  )
}

export default ChatView
