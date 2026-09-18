import { useState } from 'react'
import { CATEGORIAS } from '../constants'

const CATEGORIA_MAP = Object.fromEntries(CATEGORIAS.map((c) => [c.key, c]))

// Desglose de gastos/ingresos por categoría — comparación de magnitud, así
// que usa un solo hue (el color del área) con la barra como longitud, no
// colores por categoría. Value en la punta, nombre de categoría como texto
// plano (nunca coloreado). Ordenado de mayor a menor.
function CategoryBreakdown({ movimientos }) {
  const [tipo, setTipo] = useState('gasto')

  const confirmados = movimientos.filter((m) => m.confirmado && m.tipo === tipo)
  const totales = {}
  for (const m of confirmados) {
    totales[m.categoria] = (totales[m.categoria] || 0) + m.monto
  }
  const total = Object.values(totales).reduce((s, v) => s + v, 0)
  const filas = Object.entries(totales)
    .map(([key, monto]) => ({ ...(CATEGORIA_MAP[key] || { key, label: key, icon: '🔹' }), monto }))
    .sort((a, b) => b.monto - a.monto)

  const max = filas.length > 0 ? filas[0].monto : 0

  return (
    <div className="category-breakdown">
      <div className="category-header">
        <h3>Por categoría</h3>
        <div className="category-toggle">
          <button
            type="button"
            className={tipo === 'gasto' ? 'active' : ''}
            onClick={() => setTipo('gasto')}
          >
            Gastos
          </button>
          <button
            type="button"
            className={tipo === 'ingreso' ? 'active' : ''}
            onClick={() => setTipo('ingreso')}
          >
            Ingresos
          </button>
        </div>
      </div>

      {filas.length === 0 ? (
        <p className="category-empty">Sin {tipo === 'gasto' ? 'gastos' : 'ingresos'} confirmados todavía.</p>
      ) : (
        <ul className="category-list">
          {filas.map((f) => (
            <li key={f.key} className="category-row">
              <span className="category-label">
                {f.icon} {f.label}
              </span>
              <div className="category-bar-track">
                <div
                  className="category-bar-fill"
                  style={{ width: max > 0 ? `${(f.monto / max) * 100}%` : '0%' }}
                />
              </div>
              <span className="category-value">S/ {f.monto.toFixed(0)}</span>
            </li>
          ))}
        </ul>
      )}

      {total > 0 && (
        <p className="category-total">
          Total {tipo === 'gasto' ? 'gastado' : 'recibido'}: <strong>S/ {total.toFixed(0)}</strong>
        </p>
      )}
    </div>
  )
}

export default CategoryBreakdown
