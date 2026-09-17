function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Bloque determinístico (no depende de una respuesta de Claude) con el
// resumen del día: pendientes de hoy/vencidos, saldo confirmado vs
// proyectado, y stock de negocios. Se calcula directo del estado ya
// cargado, así que aparece instantáneo y siempre con números exactos.
function DailyBriefing({ todos, negocios, finanzas }) {
  const today = todayStr()
  const pendHoy = todos.filter((t) => !t.done && t.dueDate === today)
  const vencidos = todos.filter((t) => !t.done && t.dueDate && t.dueDate < today)

  const confirmados = finanzas.movimientos.filter((m) => m.confirmado)
  const proyectados = finanzas.movimientos.filter((m) => !m.confirmado)
  const saldoConf =
    confirmados.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0) -
    confirmados.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0)
  const netoProy = proyectados.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0)

  return (
    <div className="briefing">
      <div className="briefing-row">
        <span className="briefing-item">
          <strong className={vencidos.length > 0 ? 'fin-out' : ''}>{vencidos.length}</strong> vencidos
        </span>
        <span className="briefing-item">
          <strong>{pendHoy.length}</strong> hoy
        </span>
        <span className="briefing-item">
          Saldo <strong className={saldoConf >= 0 ? 'fin-in' : 'fin-out'}>S/ {saldoConf.toFixed(0)}</strong>
          {proyectados.length > 0 && (
            <span className="briefing-proy"> (proy. S/ {(saldoConf + netoProy).toFixed(0)})</span>
          )}
        </span>
      </div>
      <div className="briefing-row briefing-row-stock">
        <span className="briefing-item">🕶️ Ray-Ban: {negocios.rayban.stock}</span>
        <span className="briefing-item">📱 iPhones: {negocios.iphone.stock}</span>
      </div>
    </div>
  )
}

export default DailyBriefing
