function daysAgo(iso) {
  if (!iso) return Infinity
  const created = new Date(iso).getTime()
  return (Date.now() - created) / (1000 * 60 * 60 * 24)
}

function InsightsPanel({ insight, loading, onGenerate }) {
  const stale = !insight || daysAgo(insight.created_at) > 7

  return (
    <div className="insights-panel">
      <div className="insights-header">
        <h3>📊 Insights de la semana</h3>
        <button type="button" className="insights-btn" onClick={onGenerate} disabled={loading}>
          {loading ? 'Analizando...' : insight ? 'Actualizar' : 'Generar'}
        </button>
      </div>

      {insight ? (
        <p className="insights-content">{insight.contenido}</p>
      ) : (
        <p className="insights-empty">
          Todavía no hay un análisis. Genera uno para ver patrones de tu última semana.
        </p>
      )}

      {insight && stale && <p className="insights-stale">Este análisis tiene más de 7 días.</p>}
    </div>
  )
}

export default InsightsPanel
