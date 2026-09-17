// Placeholder para la futura integración con Google Calendar. La tabla
// calendar_events ya existe en Supabase (con linked_todo_id para cruzar
// eventos con pendientes); este componente solo deja el espacio en la UI
// listo para cuando se conecte la API real.
function CalendarPlaceholder() {
  return (
    <div className="calendar-placeholder">
      <span className="calendar-icon">🗓️</span>
      <div>
        <p className="calendar-title">Google Calendar</p>
        <p className="calendar-subtitle">Próximamente — tus eventos se van a poder cruzar con tus pendientes.</p>
      </div>
    </div>
  )
}

export default CalendarPlaceholder
