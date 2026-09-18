import { useState } from 'react'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dueStatus(dueDate, done) {
  if (!dueDate || done) return null
  const today = todayStr()
  if (dueDate < today) return 'vencido'
  if (dueDate === today) return 'hoy'
  return 'proximo'
}

function sortTodos(todos) {
  const rank = { alta: 0, media: 1, baja: 2 }
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const pr = (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1)
    if (pr !== 0) return pr
    if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return 0
  })
}

function EditForm({ todo, onSave, onCancel }) {
  const [text, setText] = useState(todo.text)
  const [priority, setPriority] = useState(todo.priority)
  const [dueDate, setDueDate] = useState(todo.dueDate || '')

  function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return
    onSave({ text, priority, dueDate: dueDate || null })
  }

  return (
    <form className="edit-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Editar texto"
        autoFocus
      />
      <div className="edit-form-row">
        <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Editar prioridad">
          <option value="alta">🔥 Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Editar fecha límite"
        />
      </div>
      <div className="edit-form-actions">
        <button type="button" className="edit-cancel-btn" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="edit-save-btn">
          Guardar
        </button>
      </div>
    </form>
  )
}

function DashboardView({ area, todos, onToggle, onDelete, onAdd, onEdit, extra }) {
  const [draft, setDraft] = useState('')
  const [priority, setPriority] = useState('media')
  const [dueDate, setDueDate] = useState('')
  const [editingId, setEditingId] = useState(null)

  const today = todayStr()
  const sorted = sortTodos(todos)
  const pending = todos.filter((t) => !t.done)
  const vencidos = pending.filter((t) => t.dueDate && t.dueDate < today)
  const hoy = pending.filter((t) => t.dueDate === today)

  function handleSubmit(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    onAdd({ text, priority, dueDate: dueDate || null })
    setDraft('')
    setDueDate('')
  }

  function handleSaveEdit(id, payload) {
    onEdit(id, payload)
    setEditingId(null)
  }

  return (
    <div className="dashboard" style={{ '--area-color': area.color }}>
      <div className="dashboard-header">
        <span className="dashboard-icon">{area.icon}</span>
        <h2>{area.label}</h2>
      </div>

      <div className="stats-row">
        <div className="stat">
          <span className="stat-value">{pending.length}</span>
          <span className="stat-label">Pendientes</span>
        </div>
        <div className="stat stat-warn">
          <span className="stat-value">{vencidos.length}</span>
          <span className="stat-label">Vencidos</span>
        </div>
        <div className="stat stat-info">
          <span className="stat-value">{hoy.length}</span>
          <span className="stat-label">Hoy</span>
        </div>
      </div>

      {extra}

      <ul className="todo-list dashboard-list">
        {sorted.length === 0 && <li className="empty">Sin pendientes</li>}
        {sorted.map((todo) => {
          const status = dueStatus(todo.dueDate, todo.done)

          if (editingId === todo.id) {
            return (
              <li key={todo.id} className="editing">
                <EditForm todo={todo} onSave={(payload) => handleSaveEdit(todo.id, payload)} onCancel={() => setEditingId(null)} />
              </li>
            )
          }

          return (
            <li key={todo.id} className={todo.done ? 'done' : ''}>
              <div className="todo-main">
                <label>
                  <input
                    type="checkbox"
                    checked={todo.done}
                    onChange={() => onToggle(todo.id)}
                  />
                  <span>{todo.text}</span>
                </label>
                <button
                  type="button"
                  className="edit-btn"
                  aria-label={`Editar "${todo.text}"`}
                  onClick={() => setEditingId(todo.id)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="delete-btn"
                  aria-label={`Eliminar "${todo.text}"`}
                  onClick={() => onDelete(todo.id)}
                >
                  ×
                </button>
              </div>
              <div className="todo-meta">
                <span className={`chip priority-${todo.priority}`}>{todo.priority}</span>
                {status && (
                  <span className={`chip due-${status}`}>
                    {status === 'vencido' ? '⚠️' : status === 'hoy' ? '⏰' : '📅'} {todo.dueDate}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <form className="add-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="add-form-text"
          placeholder="Nuevo pendiente..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className="add-form-row">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            aria-label="Prioridad"
          >
            <option value="alta">🔥 Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            aria-label="Fecha límite"
          />
          <button type="submit" aria-label={`Agregar a ${area.label}`}>
            +
          </button>
        </div>
      </form>
    </div>
  )
}

export default DashboardView
