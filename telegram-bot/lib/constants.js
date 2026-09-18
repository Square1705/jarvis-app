// Copia de src/constants.js del frontend. Duplicada a propósito: Railway
// solo despliega esta carpeta (telegram-bot/), no el repo completo, así
// que un import cruzado tipo '../../src/constants.js' falla en producción
// aunque funcione en local. Si cambias las categorías en el frontend,
// actualiza también este archivo.
export const CATEGORIAS = [
  { key: 'comida', label: 'Comida', icon: '🍔' },
  { key: 'transporte', label: 'Transporte', icon: '🚌' },
  { key: 'vivienda', label: 'Vivienda', icon: '🏠' },
  { key: 'entretenimiento', label: 'Entretenimiento', icon: '🎮' },
  { key: 'salud', label: 'Salud', icon: '🩺' },
  { key: 'negocio', label: 'Negocio', icon: '💼' },
  { key: 'deudas', label: 'Deudas', icon: '💳' },
  { key: 'ahorro', label: 'Ahorro', icon: '🏦' },
  { key: 'sueldo', label: 'Sueldo', icon: '💵' },
  { key: 'ventas', label: 'Ventas', icon: '💸' },
  { key: 'otros', label: 'Otros', icon: '🔹' },
]

export const CATEGORIA_KEYS = CATEGORIAS.map((c) => c.key)
