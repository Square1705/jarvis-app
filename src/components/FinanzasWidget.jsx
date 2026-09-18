import { useState } from 'react'
import { CATEGORIAS } from '../constants'

function FinanzasWidget({ movimientos, onAdd, onDelete, onConfirm }) {
  const [tipo, setTipo] = useState('gasto')
  const [monto, setMonto] = useState('')
  const [concepto, setConcepto] = useState('')
  const [categoria, setCategoria] = useState('otros')
  const [confirmado, setConfirmado] = useState(true)

  const confirmados = movimientos.filter((m) => m.confirmado)
  const proyectados = movimientos.filter((m) => !m.confirmado)

  const ingresos = confirmados.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const gastos = confirmados.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0)
  const saldo = ingresos - gastos

  const netoProyectado = proyectados.reduce(
    (s, m) => s + (m.tipo === 'ingreso' ? m.monto : -m.monto),
    0,
  )

  function handleSubmit(e) {
    e.preventDefault()
    const value = Number(monto)
    if (!value || value <= 0 || !concepto.trim()) return
    onAdd({ tipo, monto: value, concepto: concepto.trim(), categoria, confirmado })
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

      {proyectados.length > 0 && (
        <div className="fin-proyectado-note">
          📋 Si se cumplen tus {proyectados.length} proyección(es): saldo quedaría en{' '}
          <strong className={saldo + netoProyectado >= 0 ? 'fin-in' : 'fin-out'}>
            S/ {(saldo + netoProyectado).toFixed(0)}
          </strong>
        </div>
      )}

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
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría">
          {CATEGORIAS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.icon} {c.label}
            </option>
          ))}
        </select>
        <button type="submit" aria-label="Registrar movimiento">
          +
        </button>
      </form>

      <label className="fin-confirmado-toggle">
        <input
          type="checkbox"
          checked={confirmado}
          onChange={(e) => setConfirmado(e.target.checked)}
        />
        <span>{confirmado ? 'Ya sucedió' : 'Es una proyección a futuro'}</span>
      </label>

      <ul className="fin-list">
        {movimientos.length === 0 && <li className="empty">Sin movimientos</li>}
        {[...proyectados, ...confirmados].map((m) => (
          <li key={m.id} className={`fin-item fin-${m.tipo} ${!m.confirmado ? 'fin-proyectado' : ''}`}>
            <div className="fin-item-main">
              <span className="fin-concepto">
                {!m.confirmado && <span className="chip fin-chip-proyectado">Proyectado</span>}
                {m.concepto}
                <span className="fin-categoria">{m.categoria}</span>
              </span>
              <span className="fin-monto">
                {m.tipo === 'gasto' ? '-' : '+'}S/ {m.monto.toFixed(2)}
              </span>
            </div>
            <div className="fin-item-actions">
              {!m.confirmado && (
                <button
                  type="button"
                  className="fin-confirm-btn"
                  onClick={() => onConfirm(m.id)}
                >
                  ✓ Confirmar
                </button>
              )}
              <button
                type="button"
                className="delete-btn"
                aria-label="Eliminar movimiento"
                onClick={() => onDelete(m.id)}
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default FinanzasWidget
