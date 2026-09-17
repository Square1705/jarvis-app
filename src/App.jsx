import { useEffect, useRef, useState } from 'react'
import Anthropic from '@anthropic-ai/sdk'
import BottomNav from './components/BottomNav'
import ChatView from './components/ChatView'
import DashboardView from './components/DashboardView'
import NegociosWidget from './components/NegociosWidget'
import FinanzasWidget from './components/FinanzasWidget'
import './App.css'

// --- Config ---------------------------------------------------------------

const MODEL_ID = 'claude-sonnet-4-6'
const MAX_TOOL_TURNS = 6

const TODOS_KEY = 'jarvis_todos_v3'
const NEGOCIOS_KEY = 'jarvis_negocios_v1'
const FINANZAS_KEY = 'jarvis_finanzas_v1'
const LEGACY_TODOS_KEY_V2 = 'jarvis_state_v2'
const LEGACY_TODOS_KEY_V1 = 'jarvis_areas_v1'
const CHAT_KEY = 'jarvis_chat_v1'

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

// API key expuesta al bundle del navegador vía Vite. Esto es intencional
// para esta app personal (sin backend todavía): cualquiera que abra las
// devtools de esta página puede ver la key. No despliegues esto público
// sin mover la llamada a un backend/proxy.
const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
const client = apiKey
  ? new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  : null

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
        area: {
          type: 'string',
          enum: AREAS,
          description: 'Área de vida a la que pertenece el pendiente.',
        },
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
      properties: {
        id: { type: 'string', description: 'id del pendiente a completar.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'eliminar_pendiente',
    description: 'Elimina un pendiente existente, dado su id.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id del pendiente a eliminar.' },
      },
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
        estado: {
          type: 'string',
          enum: ['pendientes', 'completados', 'vencidos', 'todos'],
        },
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
    description: 'Registra un ingreso o gasto de dinero en las finanzas personales de Gonzalo.',
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
      },
      required: ['tipo', 'monto', 'concepto'],
    },
  },
]

// --- Helpers ----------------------------------------------------------------

function createId() {
  return `${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
}

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

function loadTodos() {
  try {
    const raw = localStorage.getItem(TODOS_KEY)
    if (raw) return JSON.parse(raw)

    // Migración desde la versión "dashboard" anterior (v2: { areas, negocios })
    const v2raw = localStorage.getItem(LEGACY_TODOS_KEY_V2)
    if (v2raw) {
      const v2 = JSON.parse(v2raw)
      const flat = []
      for (const area of AREAS) {
        for (const t of v2.areas?.[area] || []) {
          flat.push({
            id: t.id || createId(),
            area,
            text: t.text,
            priority: t.priority || 'media',
            dueDate: t.dueDate || null,
            done: !!t.done,
          })
        }
      }
      return flat
    }

    // Migración desde la primera versión (v1, sin prioridad/fecha)
    const v1raw = localStorage.getItem(LEGACY_TODOS_KEY_V1)
    if (v1raw) {
      const v1 = JSON.parse(v1raw)
      const flat = []
      for (const area of AREAS) {
        for (const t of v1[area] || []) {
          flat.push({
            id: t.id || createId(),
            area,
            text: t.text,
            priority: 'media',
            dueDate: null,
            done: !!t.done,
          })
        }
      }
      return flat
    }
  } catch {
    // localStorage corrupto: seguimos con lista vacía
  }
  return []
}

function loadNegocios() {
  try {
    const raw = localStorage.getItem(NEGOCIOS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        rayban: { ...DEFAULT_NEGOCIOS.rayban, ...parsed.rayban },
        iphone: { ...DEFAULT_NEGOCIOS.iphone, ...parsed.iphone },
      }
    }
    // Migración desde v2, que guardaba .negocios dentro del mismo objeto
    const v2raw = localStorage.getItem(LEGACY_TODOS_KEY_V2)
    if (v2raw) {
      const v2 = JSON.parse(v2raw)
      if (v2.negocios) {
        return {
          rayban: { ...DEFAULT_NEGOCIOS.rayban, ...v2.negocios.rayban },
          iphone: { ...DEFAULT_NEGOCIOS.iphone, ...v2.negocios.iphone },
        }
      }
    }
  } catch {
    // ignorar
  }
  return DEFAULT_NEGOCIOS
}

function loadFinanzas() {
  try {
    const raw = localStorage.getItem(FINANZAS_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignorar
  }
  return { movimientos: [] }
}

function loadChat() {
  try {
    const raw = localStorage.getItem(CHAT_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignorar
  }
  return []
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

  const ingresos = finanzas.movimientos
    .filter((m) => m.tipo === 'ingreso')
    .reduce((s, m) => s + m.monto, 0)
  const gastos = finanzas.movimientos
    .filter((m) => m.tipo === 'gasto')
    .reduce((s, m) => s + m.monto, 0)
  const movimientosTexto =
    finanzas.movimientos.length === 0
      ? '(sin movimientos registrados)'
      : finanzas.movimientos
          .slice(0, 10)
          .map((m) => `- ${m.fecha} | ${m.tipo} | S/ ${m.monto} | ${m.concepto}`)
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
- Ingresos totales registrados: S/ ${ingresos.toFixed(2)}
- Gastos totales registrados: S/ ${gastos.toFixed(2)}
- Saldo: S/ ${(ingresos - gastos).toFixed(2)}
- Movimientos recientes:
${movimientosTexto}

CÓMO DEBES COMPORTARTE:
- Cuando Gonzalo mencione algo que tiene que hacer/resolver, créalo como pendiente con crear_pendiente (elige el área correcta: trabajo, negocios, personal o finanzas).
- Si no da fecha límite, sugiere tú una fecha razonable según la urgencia y dilo explícitamente en tu respuesta (ej: "le puse fecha para el viernes porque...").
- Cuando mencione una venta, cobro o cambio de stock de Ray-Ban/iPhone, usa actualizar_negocio.
- Cuando mencione un ingreso o gasto de dinero, regístralo con registrar_movimiento.
- No listes datos en bruto sin razón: cuando hables de pendientes o negocios, sugiere cómo abordarlos o en qué orden.
- Si detectas pendientes vencidos, sin fecha, o que vencen en los próximos 2 días, menciónalos proactivamente aunque no te lo pidan.
- Sé breve. Nada de relleno ni disclaimers innecesarios.`
}

function executeTool(name, input, state) {
  const { todos, negocios, finanzas } = state
  const today = todayStr()

  switch (name) {
    case 'crear_pendiente': {
      const nuevo = {
        id: createId(),
        area: AREAS.includes(input.area) ? input.area : 'personal',
        text: input.texto,
        priority: ['alta', 'media', 'baja'].includes(input.prioridad) ? input.prioridad : 'media',
        dueDate: input.fecha_limite || null,
        done: false,
      }
      return { state: { ...state, todos: [...todos, nuevo] }, result: { ok: true, pendiente: nuevo } }
    }

    case 'completar_pendiente': {
      const idx = todos.findIndex((t) => t.id === input.id)
      if (idx === -1) return { state, result: { ok: false, error: 'id no encontrado' } }
      const next = [...todos]
      next[idx] = { ...next[idx], done: true }
      return { state: { ...state, todos: next }, result: { ok: true, pendiente: next[idx] } }
    }

    case 'eliminar_pendiente': {
      const existed = todos.some((t) => t.id === input.id)
      return {
        state: { ...state, todos: todos.filter((t) => t.id !== input.id) },
        result: { ok: existed },
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
      if (!negocios[input.producto]) {
        return { state, result: { ok: false, error: 'producto inválido' } }
      }
      const actual = negocios[input.producto][input.campo] ?? 0
      let siguiente = actual
      if (input.operacion === 'set') siguiente = input.valor
      else if (input.operacion === 'sumar') siguiente = actual + input.valor
      else if (input.operacion === 'restar') siguiente = actual - input.valor
      siguiente = Math.max(0, siguiente)

      const nextNegocios = {
        ...negocios,
        [input.producto]: { ...negocios[input.producto], [input.campo]: siguiente },
      }
      return {
        state: { ...state, negocios: nextNegocios },
        result: { ok: true, producto: input.producto, campo: input.campo, valorAnterior: actual, valorNuevo: siguiente },
      }
    }

    case 'registrar_movimiento': {
      const nuevo = {
        id: createId(),
        tipo: input.tipo === 'ingreso' ? 'ingreso' : 'gasto',
        monto: Number(input.monto) || 0,
        concepto: input.concepto || '',
        fecha: input.fecha || today,
      }
      return {
        state: { ...state, finanzas: { ...finanzas, movimientos: [nuevo, ...finanzas.movimientos] } },
        result: { ok: true, movimiento: nuevo },
      }
    }

    default:
      return { state, result: { ok: false, error: `Herramienta desconocida: ${name}` } }
  }
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
  const [todos, setTodos] = useState(loadTodos)
  const [negocios, setNegocios] = useState(loadNegocios)
  const [finanzas, setFinanzas] = useState(loadFinanzas)
  const [messages, setMessages] = useState(loadChat)
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

  useEffect(() => {
    try {
      localStorage.setItem(TODOS_KEY, JSON.stringify(todos))
    } catch {
      // localStorage no disponible
    }
  }, [todos])

  useEffect(() => {
    try {
      localStorage.setItem(NEGOCIOS_KEY, JSON.stringify(negocios))
    } catch {
      // localStorage no disponible
    }
  }, [negocios])

  useEffect(() => {
    try {
      localStorage.setItem(FINANZAS_KEY, JSON.stringify(finanzas))
    } catch {
      // localStorage no disponible
    }
  }, [finanzas])

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages))
    } catch {
      // localStorage no disponible
    }
  }, [messages])

  useEffect(() => {
    if (kickoffFired.current) return
    kickoffFired.current = true

    if (notifEnabled) notificarSiHaceFalta(stateRef.current.todos)

    if (messages.length === 0) {
      runConversation([{ role: 'user', content: KICKOFF_PROMPT, hidden: true }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function runConversation(historyToSend) {
    if (!client) {
      setError('Falta configurar VITE_ANTHROPIC_API_KEY en el archivo .env')
      return
    }

    setLoading(true)
    setError(null)
    setMessages(historyToSend)

    let currentMessages = historyToSend
    let workingState = stateRef.current

    try {
      for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
        const response = await client.messages.create({
          model: MODEL_ID,
          max_tokens: 4096,
          system: buildSystemPrompt(workingState),
          tools: TOOLS,
          messages: toApiMessages(currentMessages),
        })

        currentMessages = [...currentMessages, { role: 'assistant', content: response.content }]

        if (response.stop_reason !== 'tool_use') break

        const toolResults = []
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue
          const { state: nextState, result } = executeTool(block.name, block.input, workingState)
          workingState = nextState
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        }

        currentMessages = [...currentMessages, { role: 'user', content: toolResults }]
      }

      setTodos(workingState.todos)
      setNegocios(workingState.negocios)
      setFinanzas(workingState.finanzas)
      setMessages(currentMessages)
    } catch (err) {
      let msg = 'No pude conectar con Claude. Intenta de nuevo.'
      if (err instanceof Anthropic.AuthenticationError) {
        msg = 'La API key no es válida. Revisa VITE_ANTHROPIC_API_KEY en tu .env.'
      } else if (err instanceof Anthropic.RateLimitError) {
        msg = 'Se alcanzó el límite de peticiones. Espera un momento e intenta de nuevo.'
      } else if (err instanceof Anthropic.APIError) {
        msg = `Error de la API (${err.status}): ${err.message}`
      }
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
    runConversation([...messages, { role: 'user', content: text }])
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

  function toggleTodo(id) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)))
  }

  function deleteTodo(id) {
    setTodos((prev) => prev.filter((t) => t.id !== id))
  }

  function addTodoManual(area, { text, priority, dueDate }) {
    const nuevo = { id: createId(), area, text, priority, dueDate: dueDate || null, done: false }
    setTodos((prev) => [...prev, nuevo])
  }

  function updateNegocio(productKey, field, rawValue) {
    const value = rawValue === '' ? 0 : Math.max(0, Number(rawValue))
    setNegocios((prev) => ({ ...prev, [productKey]: { ...prev[productKey], [field]: value } }))
  }

  function addMovimiento({ tipo, monto, concepto }) {
    const nuevo = { id: createId(), tipo, monto: Number(monto) || 0, concepto, fecha: todayStr() }
    setFinanzas((prev) => ({ ...prev, movimientos: [nuevo, ...prev.movimientos] }))
  }

  function deleteMovimiento(id) {
    setFinanzas((prev) => ({ ...prev, movimientos: prev.movimientos.filter((m) => m.id !== id) }))
  }

  const activeArea = AREA_CONFIG.find((a) => a.key === activeTab)

  return (
    <div className="jarvis">
      <header className="jarvis-header">
        <div className="header-title">
          <span className="pulse-dot" aria-hidden="true" />
          <h1>JARVIS</h1>
        </div>
        <button
          type="button"
          className={`notif-btn ${notifEnabled ? 'on' : ''}`}
          onClick={handleEnableNotifications}
          aria-label="Activar recordatorios"
          title="Activar recordatorios"
        >
          {notifEnabled ? '🔔' : '🔕'}
        </button>
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
