import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseAdmin } from './supabaseAdmin.js'
import { CATEGORIA_KEYS } from '../src/constants.js'

// Misma lógica que src/App.jsx del frontend (tools, prompt, reglas de
// negocio) y que tenía telegram-bot/lib/brain.js. Se mantiene duplicada a
// propósito: el frontend corre con la key anon del usuario + RLS, esto
// corre server-side con la service_role key. Si cambias el comportamiento
// de JARVIS en un lado, revisa si también aplica acá.

let claudeClient = null
function getClaude() {
  if (!claudeClient) claudeClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return claudeClient
}

const MODEL_ID = 'claude-sonnet-4-6'
const MAX_TOOL_TURNS = 6

export const AREAS = ['trabajo', 'negocios', 'personal', 'finanzas']

const KICKOFF_NOTE =
  'Mensaje recibido por Telegram (no por la web). Responde igual de breve y directo.'

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
          description: 'Prioridad estimada. Si el usuario no la da explícitamente, inférela del contexto.',
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
    name: 'editar_pendiente',
    description:
      'Edita el texto, la prioridad y/o la fecha límite de un pendiente ya existente. ' +
      'Úsala cuando Gonzalo quiera cambiar algo de un pendiente en vez de crear uno nuevo.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id del pendiente a editar.' },
        texto: { type: 'string', description: 'Nuevo texto, solo si cambia.' },
        prioridad: { type: 'string', enum: ['alta', 'media', 'baja'], description: 'Nueva prioridad, solo si cambia.' },
        fecha_limite: {
          type: 'string',
          description: 'Nueva fecha límite en formato YYYY-MM-DD, solo si cambia. Manda cadena vacía para quitarla.',
        },
      },
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
      'Actualiza el stock, el monto por cobrar, o el precio promedio de venta de uno ' +
      'de los negocios de Gonzalo (Ray-Ban cámara o iPhones). Úsala cuando mencione una ' +
      'venta, una compra de mercadería, un cobro, o te diga a cuánto vende cada uno.',
    input_schema: {
      type: 'object',
      properties: {
        producto: { type: 'string', enum: ['rayban', 'iphone'] },
        campo: { type: 'string', enum: ['stock', 'porCobrar', 'precioPromedio'] },
        operacion: {
          type: 'string',
          enum: ['set', 'sumar', 'restar'],
          description:
            "'sumar'/'restar' para ajustes relativos (ej: vendió 2 unidades -> restar 2 " +
            "al stock, sumar el monto a porCobrar). 'set' para fijar un valor exacto " +
            "(úsalo siempre para precioPromedio).",
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
        categoria: {
          type: 'string',
          enum: CATEGORIA_KEYS,
          description: 'Categoría del movimiento. Si no es obvia, usa "otros".',
        },
        fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD. Si no se especifica, se usa la de hoy.' },
        confirmado: {
          type: 'boolean',
          description:
            'true si el dinero YA se movió de verdad. false si es una proyección o plan a ' +
            'futuro que todavía no ha sucedido. Ante la duda, usa false.',
        },
      },
      required: ['tipo', 'monto', 'concepto', 'confirmado'],
    },
  },
  {
    name: 'confirmar_movimiento',
    description:
      'Marca un movimiento que estaba proyectado (confirmado=false) como confirmado, ' +
      'cuando Gonzalo indique que ese gasto/ingreso ya sucedió realmente.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'id del movimiento a confirmar.' } },
      required: ['id'],
    },
  },
]

// --- Helpers ----------------------------------------------------------------

export function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso, days) {
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
    createdAt: row.created_at,
  }
}

function rowToMovimiento(row) {
  return {
    id: row.id,
    tipo: row.tipo,
    monto: Number(row.monto),
    concepto: row.concepto,
    categoria: row.categoria || 'otros',
    fecha: row.fecha,
    confirmado: row.confirmado,
  }
}

function logActivity(userId, tipo, detalle) {
  getSupabaseAdmin()
    .from('activity_log')
    .insert({ user_id: userId, tipo, detalle: detalle || {} })
    .then(() => {})
}

const DEFAULT_NEGOCIOS = {
  rayban: { label: 'Ray-Ban Cámara', icon: '🕶️', stock: 0, porCobrar: 0, precioPromedio: 0 },
  iphone: { label: 'iPhones', icon: '📱', stock: 0, porCobrar: 0, precioPromedio: 0 },
}

export async function loadState(userId) {
  const supabase = getSupabaseAdmin()
  const [todosRes, negociosRes, movRes] = await Promise.all([
    supabase.from('todos').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('negocios').select('*').eq('user_id', userId),
    supabase.from('movimientos').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ])

  const todos = (todosRes.data || []).map(rowToTodo)

  const negocios = { ...DEFAULT_NEGOCIOS }
  for (const row of negociosRes.data || []) {
    if (negocios[row.producto]) {
      negocios[row.producto] = {
        ...negocios[row.producto],
        stock: Number(row.stock),
        porCobrar: Number(row.por_cobrar),
        precioPromedio: Number(row.precio_promedio || 0),
      }
    }
  }

  const finanzas = { movimientos: (movRes.data || []).map(rowToMovimiento) }

  return { todos, negocios, finanzas }
}

export async function loadProfile(userId) {
  const { data } = await getSupabaseAdmin().from('jarvis_profile').select('resumen').eq('user_id', userId).maybeSingle()
  return data?.resumen || null
}

function buildSystemPrompt(state, mood, profile) {
  const { todos, negocios, finanzas } = state
  const today = todayStr()
  const staleLimit = addDays(today, -3)

  const pendientesTexto =
    todos.length === 0
      ? '(No hay pendientes guardados todavía.)'
      : todos
          .map(
            (t) =>
              `- [${t.done ? 'x' : ' '}] id:${t.id} | ${t.area} | ${t.text} | prioridad:${t.priority} | vence:${t.dueDate || 'sin fecha'}`,
          )
          .join('\n')

  const staleSinFecha = todos.filter(
    (t) => !t.done && !t.dueDate && t.createdAt && t.createdAt.slice(0, 10) <= staleLimit,
  )
  const staleTexto =
    staleSinFecha.length === 0 ? '(ninguno)' : staleSinFecha.map((t) => `- id:${t.id} | ${t.area} | ${t.text}`).join('\n')

  const confirmados = finanzas.movimientos.filter((m) => m.confirmado)
  const proyectados = finanzas.movimientos.filter((m) => !m.confirmado)

  const ingresosConf = confirmados.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const gastosConf = confirmados.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0)
  const saldoConf = ingresosConf - gastosConf

  const netoProyectado = proyectados.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0)

  const confirmadosTexto =
    confirmados.length === 0
      ? '(sin movimientos confirmados)'
      : confirmados
          .slice(0, 10)
          .map((m) => `- ${m.fecha} | ${m.tipo} | S/ ${m.monto} | ${m.categoria} | ${m.concepto}`)
          .join('\n')

  const proyectadosTexto =
    proyectados.length === 0
      ? '(sin proyecciones pendientes)'
      : proyectados.map((m) => `- id:${m.id} | ${m.fecha} | ${m.tipo} | S/ ${m.monto} | ${m.concepto}`).join('\n')

  return `Eres JARVIS, el asistente de vida personal de Gonzalo. Hablas en español, tono cercano, directo y eficiente — como un asistente de confianza, no como un chatbot corporativo. Respuestas cortas salvo que se pida detalle. ${KICKOFF_NOTE}

CONTEXTO DE GONZALO:
- 22 años, vive en Lima, Perú.
- Analista de datos en Entel Perú (SQL, Python, Power BI).
- Se está mudando a un departamento propio en Breña.
- Tiene dos negocios secundarios: venta de lentes Ray-Ban con cámara, y venta de iPhones.
- Le gusta el contenido de TikTok y los corridos tumbados.
${profile ? `\nPERFIL ACUMULADO (patrones notados a lo largo del tiempo, úsalo para sonar como que lo conoces de verdad):\n${profile}\n` : ''}
FECHA DE HOY: ${today}

PENDIENTES ACTUALES (usa el "id" exacto para completar_pendiente / eliminar_pendiente / editar_pendiente):
${pendientesTexto}

PENDIENTES SIN FECHA CREADOS HACE MÁS DE 3 DÍAS (pregúntale proactivamente qué fecha ponerles):
${staleTexto}

NEGOCIOS (stock, cobros pendientes y proyección de ingreso si vendiera todo el stock actual):
- Ray-Ban Cámara: stock=${negocios.rayban.stock}, por cobrar=S/ ${negocios.rayban.porCobrar}, precio promedio=S/ ${negocios.rayban.precioPromedio}, proyección=S/ ${(negocios.rayban.stock * negocios.rayban.precioPromedio).toFixed(2)}
- iPhones: stock=${negocios.iphone.stock}, por cobrar=S/ ${negocios.iphone.porCobrar}, precio promedio=S/ ${negocios.iphone.precioPromedio}, proyección=S/ ${(negocios.iphone.stock * negocios.iphone.precioPromedio).toFixed(2)}

FINANZAS:
- Saldo actual (solo movimientos confirmados): S/ ${saldoConf.toFixed(2)}
- Movimientos confirmados recientes:
${confirmadosTexto}
- Proyecciones a futuro AÚN NO confirmadas (usa su "id" con confirmar_movimiento cuando ya pasaron de verdad):
${proyectadosTexto}
- Si se cumplieran todas las proyecciones, el saldo quedaría en: S/ ${(saldoConf + netoProyectado).toFixed(2)}

CÓMO DEBES COMPORTARTE:
- Cuando Gonzalo mencione algo que tiene que hacer/resolver, créalo como pendiente con crear_pendiente (elige el área correcta).
- Si no da fecha límite, sugiere tú una fecha razonable y dilo explícitamente en tu respuesta.
- Cuando mencione una venta, cobro, cambio de stock, o precio de Ray-Ban/iPhone, usa actualizar_negocio.
- Si hay pendientes sin fecha creados hace más de 3 días, pregúntale proactivamente qué fecha ponerles.
- Si Gonzalo quiere cambiar el texto, prioridad o fecha de un pendiente existente, usa editar_pendiente.
- Cuando mencione dinero que YA se movió, usa registrar_movimiento con confirmado=true y asígnale una categoria.
- Cuando mencione algo que PROBABLEMENTE o PLANEA gastar/recibir a futuro, usa registrar_movimiento con confirmado=false. Ante la duda, usa false.
- Cuando confirme que una proyección ya sucedió, usa confirmar_movimiento con su id.
- No listes datos en bruto sin razón: sugiere cómo abordarlos o en qué orden.
- Si detectas pendientes vencidos, sin fecha, o que vencen en los próximos 2 días, menciónalos proactivamente.
- Sé breve. Nada de relleno ni disclaimers innecesarios.`
}

async function executeTool(name, input, state, userId) {
  const supabase = getSupabaseAdmin()
  const { todos, negocios, finanzas } = state
  const today = todayStr()

  switch (name) {
    case 'crear_pendiente': {
      const area = AREAS.includes(input.area) ? input.area : 'personal'
      const priority = ['alta', 'media', 'baja'].includes(input.prioridad) ? input.prioridad : 'media'
      const { data, error } = await supabase
        .from('todos')
        .insert({ user_id: userId, area, text: input.texto, priority, due_date: input.fecha_limite || null, done: false })
        .select()
        .single()
      if (error || !data) return { state, result: { ok: false, error: error?.message || 'error al guardar' } }
      const nuevo = rowToTodo(data)
      logActivity(userId, 'pendiente_creado', { id: nuevo.id, area: nuevo.area, texto: nuevo.text })
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
      logActivity(userId, 'pendiente_completado', { id: actualizado.id, area: actualizado.area })
      return {
        state: { ...state, todos: todos.map((t) => (t.id === actualizado.id ? actualizado : t)) },
        result: { ok: true, pendiente: actualizado },
      }
    }

    case 'editar_pendiente': {
      const cambios = {}
      if (typeof input.texto === 'string' && input.texto.trim()) cambios.text = input.texto.trim()
      if (['alta', 'media', 'baja'].includes(input.prioridad)) cambios.priority = input.prioridad
      if (typeof input.fecha_limite === 'string') cambios.due_date = input.fecha_limite || null
      if (Object.keys(cambios).length === 0) return { state, result: { ok: false, error: 'nada que editar' } }

      const { data, error } = await supabase
        .from('todos')
        .update(cambios)
        .eq('id', input.id)
        .eq('user_id', userId)
        .select()
        .single()
      if (error || !data) return { state, result: { ok: false, error: 'id no encontrado' } }
      const actualizado = rowToTodo(data)
      logActivity(userId, 'pendiente_editado', { id: actualizado.id, cambios })
      return {
        state: { ...state, todos: todos.map((t) => (t.id === actualizado.id ? actualizado : t)) },
        result: { ok: true, pendiente: actualizado },
      }
    }

    case 'eliminar_pendiente': {
      const { error } = await supabase.from('todos').delete().eq('id', input.id).eq('user_id', userId)
      return { state: { ...state, todos: todos.filter((t) => t.id !== input.id) }, result: { ok: !error } }
    }

    case 'listar_pendientes': {
      let filtered = todos
      if (input.area && input.area !== 'todas') filtered = filtered.filter((t) => t.area === input.area)
      if (input.estado === 'pendientes') filtered = filtered.filter((t) => !t.done)
      else if (input.estado === 'completados') filtered = filtered.filter((t) => t.done)
      else if (input.estado === 'vencidos') filtered = filtered.filter((t) => !t.done && t.dueDate && t.dueDate < today)
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
      const stockZeroNotified = nextBiz.stock > 0 ? false : undefined
      const { error } = await supabase.from('negocios').upsert(
        {
          user_id: userId,
          producto: input.producto,
          stock: nextBiz.stock,
          por_cobrar: nextBiz.porCobrar,
          precio_promedio: nextBiz.precioPromedio,
          ...(stockZeroNotified !== undefined ? { stock_zero_notified: stockZeroNotified } : {}),
        },
        { onConflict: 'user_id,producto' },
      )
      if (error) return { state, result: { ok: false, error: error.message } }

      logActivity(userId, 'negocio_actualizado', { producto: input.producto, campo: input.campo, valorAnterior: actual, valorNuevo: siguiente })

      return {
        state: { ...state, negocios: { ...negocios, [input.producto]: nextBiz } },
        result: { ok: true, producto: input.producto, campo: input.campo, valorAnterior: actual, valorNuevo: siguiente },
      }
    }

    case 'registrar_movimiento': {
      const categoria = CATEGORIA_KEYS.includes(input.categoria) ? input.categoria : 'otros'
      const { data, error } = await supabase
        .from('movimientos')
        .insert({
          user_id: userId,
          tipo: input.tipo === 'ingreso' ? 'ingreso' : 'gasto',
          monto: Number(input.monto) || 0,
          concepto: input.concepto || '',
          categoria,
          fecha: input.fecha || today,
          confirmado: input.confirmado !== false,
        })
        .select()
        .single()
      if (error || !data) return { state, result: { ok: false, error: error?.message || 'error al guardar' } }
      const nuevo = rowToMovimiento(data)
      logActivity(userId, 'movimiento_registrado', { id: nuevo.id, tipo: nuevo.tipo, monto: nuevo.monto, categoria: nuevo.categoria, confirmado: nuevo.confirmado })
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
          finanzas: { ...finanzas, movimientos: finanzas.movimientos.map((m) => (m.id === actualizado.id ? actualizado : m)) },
        },
        result: { ok: true, movimiento: actualizado },
      }
    }

    default:
      return { state, result: { ok: false, error: `Herramienta desconocida: ${name}` } }
  }
}

function extractText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.filter((b) => b.type === 'text').map((b) => b.text).join('\n\n').trim()
}

function toApiMessages(messages) {
  return messages.map(({ role, content }) => ({ role, content }))
}

// Punto de entrada: recibe el texto que Gonzalo mandó por Telegram,
// reutiliza el MISMO historial de chat_messages que usa la web, corre el
// loop de tools, persiste, y devuelve el texto para responderle.
export async function handleIncomingMessage(text) {
  const supabase = getSupabaseAdmin()
  const userId = process.env.JARVIS_USER_ID

  const { data: msgRows } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at')

  const history = (msgRows || []).map((m) => ({ role: m.role, content: m.content, hidden: m.hidden }))
  const persistedCount = history.length

  let currentMessages = [...history, { role: 'user', content: text }]
  let workingState = await loadState(userId)
  const profile = await loadProfile(userId)

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await getClaude().messages.create({
      model: MODEL_ID,
      max_tokens: 4096,
      system: buildSystemPrompt(workingState, null, profile),
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

  const nuevos = currentMessages.slice(persistedCount)
  if (nuevos.length > 0) {
    await supabase
      .from('chat_messages')
      .insert(nuevos.map((m) => ({ user_id: userId, role: m.role, content: m.content, hidden: !!m.hidden })))
  }

  const lastAssistant = [...currentMessages].reverse().find((m) => m.role === 'assistant')
  return extractText(lastAssistant?.content) || 'Listo.'
}
