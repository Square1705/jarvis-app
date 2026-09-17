function NegociosWidget({ negocios, onUpdate }) {
  return (
    <div className="biz-dashboard">
      {Object.entries(negocios).map(([key, biz]) => (
        <div className="biz-row" key={key}>
          <span className="biz-icon">{biz.icon}</span>
          <span className="biz-label">{biz.label}</span>
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
        </div>
      ))}
    </div>
  )
}

export default NegociosWidget
