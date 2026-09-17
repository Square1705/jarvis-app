function NegociosWidget({ negocios, onUpdate }) {
  return (
    <div className="biz-dashboard">
      {Object.entries(negocios).map(([key, biz]) => {
        const proyeccion = biz.stock * biz.precioPromedio
        return (
          <div className="biz-block" key={key}>
            <div className="biz-row">
              <span className="biz-icon">{biz.icon}</span>
              <span className="biz-label">{biz.label}</span>
              {biz.stock === 0 && <span className="chip biz-chip-empty">Sin stock</span>}
            </div>
            <div className="biz-row biz-row-fields">
              <label className="biz-field">
                <span>Stock</span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={biz.stock}
                  onChange={(e) => onUpdate(key, 'stock', e.target.value)}
                />
              </label>
              <label className="biz-field">
                <span>S/ por cobrar</span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={biz.porCobrar}
                  onChange={(e) => onUpdate(key, 'porCobrar', e.target.value)}
                />
              </label>
              <label className="biz-field">
                <span>S/ precio prom.</span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={biz.precioPromedio}
                  onChange={(e) => onUpdate(key, 'precioPromedio', e.target.value)}
                />
              </label>
            </div>
            {biz.precioPromedio > 0 && (
              <p className="biz-proyeccion">
                Proyección si vendes todo el stock: <strong>S/ {proyeccion.toFixed(0)}</strong>
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default NegociosWidget
