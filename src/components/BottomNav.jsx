function BottomNav({ tabs, activeTab, onChange }) {
  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`nav-btn ${activeTab === tab.key ? 'active' : ''}`}
          style={tab.color ? { '--tab-color': tab.color } : undefined}
          onClick={() => onChange(tab.key)}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default BottomNav
