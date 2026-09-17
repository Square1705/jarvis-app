import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import Login from './components/Login'
import BottomNav from './components/BottomNav'
import ChatView from './components/ChatView'
import DashboardView from './components/DashboardView'
import NegociosWidget from './components/NegociosWidget'
import FinanzasWidget from './components/FinanzasWidget'
import './App.css'

// --- Config ---------------------------------------------------------------

const MAX_TOOL_TURNS = 6

const AREA_CONFIG = [
  { key: 'trabajo', label: 'Trabajo', icon: '💼', color: '#22d3ee' },
  { key: 'negocios', label: 'Negocios', icon: '💸', color: '#ec4899' },
  { key: 'personal', label: 'Personal', icon: '🌱', color: '#a3e635' },
  { key: 'finanzas', label: 'Finanzas', icon: '💰', color: '#fbbf24' },
]

const AREAS = AREA_CONFIG.map((a) => a.key)

const NAV_TABS = [
  { key: 'chat', label: 'Chat', icon: '💬' },
  ...AREA_CONFIG.map((a) => ({ key: a.key, label: a.label, icon: a.icon, color: a.color })),
]

const DEFAULT_NEGOCIOS = {
  rayban: { label: 'Ray-Ban Cámara', icon: '🕶️', stock: 0, porCobrar: 0 },
  iphone: { label: 'iPhones', icon: '📱', stock: 0, porCobrar: 0 },
}

const KICKOFF_PROMPT =
  'Es el inicio de una nueva sesión. Saluda a Gonzalo de forma breve y natural. ' +
  'Si hay pendientes vencidos, sin fecha límite, o que vencen en los próximos 2 días, ' +
  'menciónalos proactivamente y sugiere cómo abordarlos. Si no hay nada urgente, ' +
  'solo saluda y pregúntale en qué le ayudas hoy. No necesitas usar listar_pendientes ' +
  'para esto, ya tienes el contexto completo en tus instrucciones.'

// --- Tools (function calling) ---------------------------------------------

const TOOLS = [
  {
    name: 'crear_pendiente',
    description:
      'Crea un nuevo pendiente en una de las áreas de vida de Gonzalo. Úsala cuando ' +
      'el usuario mencione algo que necesita hacer, resolver o recordar.',
    input_schema: {
      type: 'object',
      properties: {
        area: { type: 'string', enum: AREAS, description: 'Área de vida a la que pertenece.' },
        texto: { type: 'string', description: 'Descripción breve del pendiente.' },
        prioridad: {
          type: 'string',
          enum: ['alta', 'media', 'baja'],
          description:
            'Prioridad estimada. Si el usuario no la da explícitamente, inférela del contexto.',
        },
        fecha_limite: {
          type: 'string',
          description:
            'Fecha límite estimada en formato YYYY-MM-DD. Si el usuario no da una fecha, ' +
            'sugiere una razonable según la urgencia y explica brevemente por qué en tu respuesta.',
        },
      },
      required: ['area', 'texto'],
    },
  },
  {
    name: 'completar_pendiente',
    description: 'Marca un pendiente existente como completado, dado su id.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'id del pendiente a completar.' } },
      required: ['id'],
    },
  },
  {
    name: 'eliminar_pendiente',
    description: 'Elimina un pendiente existente, dado su id.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'id del pendiente a eliminar.' } },
      required: ['id'],
    },
  },
  {
    name: 'listar_pendientes',
    description:
      'Devuelve la lista actual de pendientes, opcionalmente filtrada por área o estado. ' +
      'Úsala para confirmar el estado antes de sugerir algo, si no estás seguro.',
    input_schema: {
      type: 'object',
      properties: {
        area: { type: 'string', enum: [...AREAS, 'todas'] },
        estado: { type: 'string', enum: ['pendientes', 'completados', 'vencidos', 'todos'] },
      },
      required: [],
    },
  },
  {
    name: 'actualizar_negocio',
    description:
      'Actualiza el stock o el monto por cobrar de uno de los negocios de Gonzalo ' +
      '(Ray-Ban cámara o iPhones). Úsala cuando mencione una venta, una compra de ' +
      'mercadería, o un cobro.',
    input_schema: {
      type: 'object',
      properties: {
        producto: { type: 'string', enum: ['rayban', 'iphone'] },
        campo: { type: 'string', enum: ['stock', 'porCobrar'] },
        operacion: {
          type: 'string',
          enum: ['set', 'sumar', 'restar'],
          description:
            "'sumar'/'restar' para ajustes relativos (ej: vendió 2 unidades -> restar 2 " +
            "al stock, sumar el monto a porCobrar). 'set' para fijar un valor exacto.",
        },
        valor: { type: 'number' },
      },
      required: ['producto', 'campo', 'operacion', 'valor'],
    },
  },
  {
    name: 'registrar_movimiento',
    description:
      'Registra un ingreso o gasto de dinero en las finanzas personales de Gonzalo — ' +
      'tanto movimientos que ya sucedieron como proyecciones/planes a futuro.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['ingreso', 'gasto'] },
        monto: { type: 'number', description: 'Monto en soles (S/), siempre positivo.' },
        concepto: { type: 'string', description: 'Breve descripción del movimiento.' },
        fecha: {
          type: 'string',
          description: 'Fecha en formato YYYY-MM-DD. Si no se especifica, se usa la de hoy.',
        },
        confirmado: {
          type: 'boolean',
          description:
            'true si el dinero YA se movió de verdad (ya gastó, ya pagó, ya le depositaron). ' +
            'false si es una proyección o plan a futuro que todavía no ha sucedido (ej: ' +
            '"probablemente gaste 1800 mañana"). Ante la duda, usa false.',
        },
      },
      required: ['tipo', 'monto', 'concepto', 'confirmado'],
    },
  },
  {
    name: 'confirmar_movimiento',
    description:
      'Marca un movimiento que estaba proyectado (confirmado=false) como confirmado, ' +
      'cuando Gonzalo indique que ese gasto/ingreso ya sucedió realmente. No crea un ' +
      'movimiento nuevo, actualiza el existente.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'id del movimiento a confirmar.' } },
      required: ['id'],
    },
  },
]

// --- Helpers ----------------------------------------------------------------

function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rowToTodo(row) {
  return {
    id: row.id,
    area: row.area,
    text: row.text,
    priority: row.priority,
    dueDate: row.due_date,
    done: row.done,
  }
}

function rowToMovimiento(row) {
  return {
    id: row.id,
    tipo: row.tipo,
    monto: Number(row.monto),
    concepto: row.concepto,
    fecha: row.fecha,
    confirmado: row.confirmado,
  }
}

function buildSystemPrompt(state) {
  const { todos, negocios, finanzas } = state
  const today = todayStr()

  const pendientesTexto =
    todos.length === 0
      ? '(No hay pendientes guardados todavía.)'
      : todos
          .map(
            (t) =>
              `- [${t.done ? 'x' : ' '}] id:${t.id} | ${t.area} | ${t.text} | prioridad:${t.priority} | vence:${t.dueDate || 'sin fecha'}`,
          )
          .join('\n')

  const confirmados = finanzas.movimientos.filter((m) => m.confirmado)
  const proyectados = finanzas.movimientos.filter((m) => !m.confirmado)

  const ingresosConf = confirmados.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const gastosConf = confirmados.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0)
  const saldoConf = ingresosConf - gastosConf

  const netoProyectado = proyectados.reduce(
    (s, m) => s + (m.tipo === 'ingreso' ? m.monto : -m.monto),
    0,
  )

  const confirmadosTexto =
    confirmados.length === 0
      ? '(sin movimientos confirmados)'
      : confirmados
          .slice(0, 10)
          .map((m) => `- ${m.fecha} | ${m.tipo} | S/ ${m.monto} | ${m.concepto}`)
          .join('\n')

  const proyectadosTexto =
    proyectados.length === 0
      ? '(sin proyecciones pendientes)'
      : proyectados
          .map((m) => `- id:${m.id} | ${m.fecha} | ${m.tipo} | S/ ${m.monto} | ${m.concepto}`)
          .join('\n')

  return `Eres JARVIS, el asistente de vida personal de Gonzalo. Hablas en español, tono cercano, directo y eficiente — como un asistente de confianza, no como un chatbot corporativo. Respuestas cortas salvo que se pida detalle.

CONTEXTO DE GONZALO:
- 22 años, vive en Lima, Perú.
- Analista de datos en Entel Perú (SQL, Python, Power BI).
- Se está mudando a un departamento propio en Breña.
- Tiene dos negocios secundarios: venta de lentes Ray-Ban con cámara, y venta de iPhones.
- Le gusta el contenido de TikTok y los corridos tumbados.

FECHA DE HOY: ${today}

PENDIENTES ACTUALES (usa el "id" exacto para completar_pendiente / eliminar_pendiente):
${pendientesTexto}

NEGOCIOS (stock y cobros pendientes):
- Ray-Ban Cámara: stock=${negocios.rayban.stock}, por cobrar=S/ ${negocios.rayban.porCobrar}
- iPhones: stock=${negocios.iphone.stock}, por cobrar=S/ ${negocios.iphone.porCobrar}

FINANZAS:
- Saldo actual (solo movimientos confirmados, dinero que ya se movió de verdad): S/ ${saldoConf.toFixed(2)}
- Movimientos confirmados recientes:
${confirmadosTexto}
- Proyecciones a futuro AÚN NO confirmadas (planes, estimados, "probablemente gaste X" — todavía no han sucedido, usa su "id" con confirmar_movimiento cuando Gonzalo diga que ya pasaron de verdad):
${proyectadosTexto}
- Si se cumplieran todas las proyecciones de arriba, el saldo quedaría en: S/ ${(saldoConf + netoProyectado).toFixed(2)}

CÓMO DEBES COMPORTARTE:
- Cuando Gonzalo mencione algo que tiene que hacer/resolver, créalo como pendiente con crear_pendiente (elige el área correcta: trabajo, negocios, personal o finanzas).
- Si no da fecha límite, sugiere tú una fecha razonable según la urgencia y dilo explícitamente en tu respuesta (ej: "le puse fecha para el viernes porque...").
- Cuando mencione una venta, cobro o cambio de stock de Ray-Ban/iPhone, usa actualizar_negocio.
- Cuando mencione dinero que YA se movió (ya gastó, ya pagó, ya le depositaron, ya cobró), usa registrar_movimiento con confirmado=true.
- Cuando mencione algo que PROBABLEMENTE o PLANEA gastar/recibir a futuro (ej: "probablemente gaste 1800 mañana", "voy a cobrar 500 la próxima semana"), usa registrar_movimiento con confirmado=false — es una proyección, NO debe contarse como saldo ya gastado. Ante la duda, usa false.
- Cuando Gonzalo confirme que una proyección ya sucedió de verdad ("ya gasté eso que dije", "sí se dio el pago"), usa confirmar_movimiento con su id en vez de crear un movimiento nuevo.
- No listes datos en bruto sin razón: cuando hables de pendientes o negocios, sugiere cómo abordarlos o en qué orden.
- Si detectas pendientes vencidos, sin fecha, o que vencen en los próximos 2 días, menciónalos proactivamente aunque no te lo pidan.
- Sé breve. Nada de relleno ni disclaimers innecesarios.`
}

// Ejecuta una tool llamada por Claude: lee/escribe directo en Supabase
// (protegido por las políticas de RLS del usuario autenticado) y devuelve
// el estado en memoria actualizado para que el resto del loop lo use.
async function executeTool(name, input, state, userId) {
  const { todos, negocios, finanzas } = state
  const today = todayStr()

  switch (name) {
    case 'crear_pendiente': {
      const area = AREAS.includes(input.area) ? input.area : 'personal'
      const priority = ['alta', 'media', 'baja'].includes(input.prioridad) ? input.prioridad : 'media'
      const { data, error } = await supabase
        .from('todos')
        .insert({
          user_id: userId,
          area,
          text: input.texto,
          priority,
          due_date: input.fecha_limite || null,
          done: false,
        })
        .select()
        .single()
      if (error || !data) return { state, result: { ok: false, error: error?.message || 'error al guardar' } }
      const nuevo = rowToTodo(data)
      return { state: { ...state, todos: [...todos, nuevo] }, result: { ok: true, pendiente: nuevo } }
    }

    case 'completar_pendiente': {
      const { data, error } = await supabase
        .from('todos')
        .update({ done: true })
        .eq('id', input.id)
        .eq('user_id', userId)
        .select()
        .single()
      if (error || !data) return { state, result: { ok: false, error: 'id no encontrado' } }
      const actualizado = rowToTodo(data)
      return {
        state: { ...state, todos: todos.map((t) => (t.id === actualizado.id ? actualizado : t)) },
        result: { ok: true, pendiente: actualizado },
      }
    }

    case 'eliminar_pendiente': {
      const { error } = await supabase.from('todos').delete().eq('id', input.id).eq('user_id', userId)
      return {
        state: { ...state, todos: todos.filter((t) => t.id !== input.id) },
        result: { ok: !error },
      }
    }

    case 'listar_pendientes': {
      let filtered = todos
      if (input.area && input.area !== 'todas') filtered = filtered.filter((t) => t.area === input.area)
      if (input.estado === 'pendientes') filtered = filtered.filter((t) => !t.done)
      else if (input.estado === 'completados') filtered = filtered.filter((t) => t.done)
      else if (input.estado === 'vencidos') {
        filtered = filtered.filter((t) => !t.done && t.dueDate && t.dueDate < today)
      }
      return { state, result: { pendientes: filtered } }
    }

    case 'actualizar_negocio': {
      if (!negocios[input.producto]) return { state, result: { ok: false, error: 'producto inválido' } }
      const actual = negocios[input.producto][input.campo] ?? 0
      let siguiente = actual
      if (input.operacion === 'set') siguiente = input.valor
      else if (input.operacion === 'sumar') siguiente = actual + input.valor
      else if (input.operacion === 'restar') siguiente = actual - input.valor
      siguiente = Math.max(0, siguiente)

      const nextBiz = { ...negocios[input.producto], [input.campo]: siguiente }
      const { error } = await supabase
        .from('negocios')
        .upsert(
          { user_id: userId, producto: input.producto, stock: nextBiz.stock, por_cobrar: nextBiz.porCobrar },
          { onConflict: 'user_id,producto' },
        )
      if (error) return { state, result: { ok: false, error: error.message } }

      return {
        state: { ...state, negocios: { ...negocios, [input.producto]: nextBiz } },
        result: { ok: true, producto: input.producto, campo: input.campo, valorAnterior: actual, valorNuevo: siguiente },
      }
    }

    case 'registrar_movimiento': {
      const { data, error } = await supabase
        .from('movimientos')
        .insert({
          user_id: userId,
          tipo: input.tipo === 'ingreso' ? 'ingreso' : 'gasto',
          monto: Number(input.monto) || 0,
          concepto: input.concepto || '',
          fecha: input.fecha || today,
          confirmado: input.confirmado !== false,
        })
        .select()
        .single()
      if (error || !data) return { state, result: { ok: false, error: error?.message || 'error al guardar' } }
      const nuevo = rowToMovimiento(data)
      return {
        state: { ...state, finanzas: { ...finanzas, movimientos: [nuevo, ...finanzas.movimientos] } },
        result: { ok: true, movimiento: nuevo },
      }
    }

    case 'confirmar_movimiento': {
      const { data, error } = await supabase
        .from('movimientos')
        .update({ confirmado: true })
        .eq('id', input.id)
        .eq('user_id', userId)
        .select()
        .single()
      if (error || !data) return { state, result: { ok: false, error: 'id no encontrado' } }
      const actualizado = rowToMovimiento(data)
      return {
        state: {
          ...state,
          finanzas: {
            ...finanzas,
            movimientos: finanzas.movimientos.map((m) => (m.id === actualizado.id ? actualizado : m)),
          },
        },
        result: { ok: true, movimiento: actualizado },
      }
    }

    default:
      return { state, result: { ok: false, error: `Herramienta desconocida: ${name}` } }
  }
}

async function callClaude({ system, tools, messages }) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, tools, messages }),
  })
  const data = await res.json()
  if (!res.ok) {
    const err = new Error(data.error || `Error ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

function toApiMessages(messages) {
  return messages.map(({ role, content }) => ({ role, content }))
}

function alertaPendientes(todos) {
  const today = todayStr()
  const limite = addDays(today, 2)
  return todos.filter((t) => !t.done && (!t.dueDate || t.dueDate <= limite))
}

function notificarSiHaceFalta(todos) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const alertas = alertaPendientes(todos)
  if (alertas.length === 0) return
  new Notification('JARVIS', {
    body: `Tienes ${alertas.length} pendiente(s) sin fecha o por vencer. Abre la app para revisarlos.`,
  })
}

// --- App ---------------------------------------------------------------

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [dataLoaded, setDataLoaded] = useState(false)

  const [todos, setTodos] = useState([])
  const [negocios, setNegocios] = useState(DEFAULT_NEGOCIOS)
  const [finanzas, setFinanzas] = useState({ movimientos: [] })
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('chat')
  const [notifEnabled, setNotifEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted',
  )

  const stateRef = useRef({ todos, negocios, finanzas })
  const kickoffFired = useRef(false)

  useEffect(() => {
    stateRef.current = { todos, negocios, finanzas }
  }, [todos, negocios, finanzas])

  // --- Auth ---
  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) {
        // Sesión cerrada: limpiar todo para no filtrar datos entre cuentas
        setTodos([])
        setNegocios(DEFAULT_NEGOCIOS)
        setFinanzas({ movimientos: [] })
        setMessages([])
        setDataLoaded(false)
        kickoffFired.current = false
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // --- Carga inicial de datos del usuario autenticado ---
  useEffect(() => {
    if (!session || !supabase) return
    let cancelled = false

    async function loadAll() {
      const userId = session.user.id

      const [todosRes, negociosRes, movRes, msgRes] = await Promise.all([
        supabase.from('todos').select('*').eq('user_id', userId).order('created_at'),
        supabase.from('negocios').select('*').eq('user_id', userId),
        supabase.from('movimientos').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('chat_messages').select('*').eq('user_id', userId).order('created_at'),
      ])

      if (cancelled) return

      setTodos((todosRes.data || []).map(rowToTodo))

      const negociosMap = { ...DEFAULT_NEGOCIOS }
      for (const row of negociosRes.data || []) {
        if (negociosMap[row.producto]) {
          negociosMap[row.producto] = {
            ...negociosMap[row.producto],
            stock: Number(row.stock),
            porCobrar: Number(row.por_cobrar),
          }
        }
      }
      const existentes = new Set((negociosRes.data || []).map((r) => r.producto))
      const faltantes = ['rayban', 'iphone'].filter((p) => !existentes.has(p))
      if (faltantes.length > 0) {
        await supabase
          .from('negocios')
          .upsert(faltantes.map((p) => ({ user_id: userId, producto: p, stock: 0, por_cobrar: 0 })))
      }
      setNegocios(negociosMap)

      setFinanzas({ movimientos: (movRes.data || []).map(rowToMovimiento) })

      setMessages(
        (msgRes.data || []).map((m) => ({ role: m.role, content: m.content, hidden: m.hidden })),
      )

      setDataLoaded(true)
    }

    loadAll()
    return () => {
      cancelled = true
    }
  }, [session])

  // --- Kickoff proactivo al abrir con datos ya cargados ---
  useEffect(() => {
    if (!dataLoaded || kickoffFired.current) return
    kickoffFired.current = true

    if (notifEnabled) notificarSiHaceFalta(stateRef.current.todos)

    if (messages.length === 0) {
      runConversation([{ role: 'user', content: KICKOFF_PROMPT, hidden: true }], 0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded])

  async function runConversation(historyToSend, persistedCount) {
    setLoading(true)
    setError(null)
    setMessages(historyToSend)

    let currentMessages = historyToSend
    let workingState = stateRef.current
    const userId = session.user.id

    try {
      for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
        const response = await callClaude({
          system: buildSystemPrompt(workingState),
          tools: TOOLS,
          messages: toApiMessages(currentMessages),
        })

        currentMessages = [...currentMessages, { role: 'assistant', content: response.content }]

        if (response.stop_reason !== 'tool_use') break

        const toolResults = []
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue
          const { state: nextState, result } = await executeTool(block.name, block.input, workingState, userId)
          workingState = nextState
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
        }

        currentMessages = [...currentMessages, { role: 'user', content: toolResults }]
      }

      setTodos(workingState.todos)
      setNegocios(workingState.negocios)
      setFinanzas(workingState.finanzas)
      setMessages(currentMessages)

      const nuevos = currentMessages.slice(persistedCount)
      if (nuevos.length > 0) {
        await supabase.from('chat_messages').insert(
          nuevos.map((m) => ({ user_id: userId, role: m.role, content: m.content, hidden: !!m.hidden })),
        )
      }
    } catch (err) {
      let msg = 'No pude conectar con Claude. Intenta de nuevo.'
      if (err.status === 429) msg = 'Se alcanzó el límite de peticiones. Espera un momento e intenta de nuevo.'
      else if (err.status >= 500) msg = 'Problema en el servidor. Intenta de nuevo en un momento.'
      else if (err.message) msg = err.message
      setError(msg)
      setMessages(currentMessages)
    } finally {
      setLoading(false)
    }
  }

  function handleChatSubmit(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    runConversation([...messages, { role: 'user', content: text }], messages.length)
  }

  async function handleEnableNotifications() {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'granted') {
      setNotifEnabled(true)
      notificarSiHaceFalta(stateRef.current.todos)
      return
    }
    const permission = await Notification.requestPermission()
    const granted = permission === 'granted'
    setNotifEnabled(granted)
    if (granted) notificarSiHaceFalta(stateRef.current.todos)
  }

  async function handleLogout() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  async function toggleTodo(id) {
    const todo = todos.find((t) => t.id === id)
    if (!todo) return
    const nextDone = !todo.done
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: nextDone } : t)))
    await supabase.from('todos').update({ done: nextDone }).eq('id', id)
  }

  async function deleteTodo(id) {
    setTodos((prev) => prev.filter((t) => t.id !== id))
    await supabase.from('todos').delete().eq('id', id)
  }

  async function addTodoManual(area, { text, priority, dueDate }) {
    const userId = session.user.id
    const { data, error } = await supabase
      .from('todos')
      .insert({ user_id: userId, area, text, priority, due_date: dueDate || null, done: false })
      .select()
      .single()
    if (!error && data) setTodos((prev) => [...prev, rowToTodo(data)])
  }

  async function updateNegocio(productKey, field, rawValue) {
    const value = rawValue === '' ? 0 : Math.max(0, Number(rawValue))
    const next = { ...negocios[productKey], [field]: value }
    setNegocios((prev) => ({ ...prev, [productKey]: next }))
    await supabase.from('negocios').upsert(
      { user_id: session.user.id, producto: productKey, stock: next.stock, por_cobrar: next.porCobrar },
      { onConflict: 'user_id,producto' },
    )
  }

  async function addMovimiento({ tipo, monto, concepto, confirmado }) {
    const userId = session.user.id
    const { data, error } = await supabase
      .from('movimientos')
      .insert({
        user_id: userId,
        tipo,
        monto: Number(monto) || 0,
        concepto,
        fecha: todayStr(),
        confirmado: confirmado !== false,
      })
      .select()
      .single()
    if (!error && data) {
      setFinanzas((prev) => ({ movimientos: [rowToMovimiento(data), ...prev.movimientos] }))
    }
  }

  async function deleteMovimiento(id) {
    setFinanzas((prev) => ({ movimientos: prev.movimientos.filter((m) => m.id !== id) }))
    await supabase.from('movimientos').delete().eq('id', id)
  }

  async function confirmMovimiento(id) {
    setFinanzas((prev) => ({
      movimientos: prev.movimientos.map((m) => (m.id === id ? { ...m, confirmado: true } : m)),
    }))
    await supabase.from('movimientos').update({ confirmado: true }).eq('id', id)
  }

  if (authLoading) {
    return (
      <div className="splash">
        <span className="pulse-dot" aria-hidden="true" />
      </div>
    )
  }

  if (!supabase) {
    return (
      <div className="splash">
        <div className="msg msg-error">
          Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu .env
        </div>
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  if (!dataLoaded) {
    return (
      <div className="splash">
        <span className="pulse-dot" aria-hidden="true" />
      </div>
    )
  }

  const activeArea = AREA_CONFIG.find((a) => a.key === activeTab)

  return (
    <div className="jarvis">
      <header className="jarvis-header">
        <div className="header-title">
          <span className="pulse-dot" aria-hidden="true" />
          <h1>JARVIS</h1>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className={`notif-btn ${notifEnabled ? 'on' : ''}`}
            onClick={handleEnableNotifications}
            aria-label="Activar recordatorios"
            title="Activar recordatorios"
          >
            {notifEnabled ? '🔔' : '🔕'}
          </button>
          <button
            type="button"
            className="notif-btn"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
          >
            🚪
          </button>
        </div>
      </header>

      <main className="view-area">
        {activeTab === 'chat' && (
          <ChatView
            messages={messages}
            loading={loading}
            error={error}
            input={input}
            onInputChange={setInput}
            onSubmit={handleChatSubmit}
          />
        )}

        {activeArea && (
          <DashboardView
            area={activeArea}
            todos={todos.filter((t) => t.area === activeArea.key)}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
            onAdd={(payload) => addTodoManual(activeArea.key, payload)}
            extra={
              activeArea.key === 'negocios' ? (
                <NegociosWidget negocios={negocios} onUpdate={updateNegocio} />
              ) : activeArea.key === 'finanzas' ? (
                <FinanzasWidget
                  movimientos={finanzas.movimientos}
                  onAdd={addMovimiento}
                  onDelete={deleteMovimiento}
                  onConfirm={confirmMovimiento}
                />
              ) : null
            }
          />
        )}
      </main>

      <BottomNav tabs={NAV_TABS} activeTab={activeTab} onChange={setActiveTab} />
    </div>
  )
}

export default App
