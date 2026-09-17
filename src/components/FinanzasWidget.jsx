import { useState } from 'react'

function FinanzasWidget({ movimientos, onAdd, onDelete }) {
  const [tipo, setTipo] = useState('gasto')
  const [monto, setMonto] = useState('')
  const [concepto, setConcepto] = useState('')

  const ingresos = movimientos.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const gastos = movimientos.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0)
  const saldo = ingresos - gastos

  function handleSubmit(e) {
    e.preventDefault()
    const value = Number(monto)
    if (!value || value <= 0 || !concepto.trim()) return
    onAdd({ tipo, monto: value, concepto: concepto.trim() })
    setMonto('')
    setConcepto('')
  }

  return (
    <div className="finanzas-dashboard">
      <div className="finanzas-totals">
        <div className="fin-stat">
          <span className="stat-value fin-in">S/ {ingresos.toFixed(0)}</span>
          <span className="stat-label">Ingresos</span>
        </div>
        <div className="fin-stat">
          <span className="stat-value fin-out">S/ {gastos.toFixed(0)}</span>
          <span className="stat-label">Gastos</span>
        </div>
        <div className="fin-stat">
          <span className={`stat-value ${saldo >= 0 ? 'fin-in' : 'fin-out'}`}>
            S/ {saldo.toFixed(0)}
          </span>
          <span className="stat-label">Saldo</span>
        </div>
      </div>

      <form className="fin-add-form" onSubmit={handleSubmit}>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de movimiento">
          <option value="gasto">Gasto</option>
          <option value="ingreso">Ingreso</option>
        </select>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Monto"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        <input
          type="text"
          placeholder="Concepto"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
        />
        <button type="submit" aria-label="Registrar movimiento">
          +
        </button>
      </form>

      <ul className="fin-list">
        {movimientos.length === 0 && <li className="empty">Sin movimientos</li>}
        {movimientos.slice(0, 20).map((m) => (
          <li key={m.id} className={`fin-item fin-${m.tipo}`}>
            <span className="fin-concepto">{m.concepto}</span>
            <span className="fin-monto">
              {m.tipo === 'gasto' ? '-' : '+'}S/ {m.monto.toFixed(2)}
            </span>
            <button
              type="button"
              className="delete-btn"
              aria-label="Eliminar movimiento"
              onClick={() => onDelete(m.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default FinanzasWidget
