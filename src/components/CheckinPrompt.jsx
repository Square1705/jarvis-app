const MOODS = [
  { value: 1, icon: '😞' },
  { value: 2, icon: '😕' },
  { value: 3, icon: '😐' },
  { value: 4, icon: '🙂' },
  { value: 5, icon: '😄' },
]

function CheckinPrompt({ onSubmit }) {
  return (
    <div className="checkin">
      <p className="checkin-question">¿Cómo estás hoy?</p>
      <div className="checkin-options">
        {MOODS.map((m) => (
          <button
            key={m.value}
            type="button"
            className="checkin-btn"
            onClick={() => onSubmit(m.value)}
            aria-label={`Ánimo ${m.value} de 5`}
          >
            {m.icon}
          </button>
        ))}
      </div>
    </div>
  )
}

export default CheckinPrompt
