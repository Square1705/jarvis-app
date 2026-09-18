# JARVIS

Asistente de vida personal — chat con Claude, dashboards de pendientes/negocios/finanzas, y un bot de Telegram. Todo corre gratis en el plan Hobby de Vercel (sin servidor persistente).

## Stack

- **Frontend**: React + Vite, PWA instalable, `src/`
- **Backend serverless**: funciones en `api/` (Vercel) — proxy a Claude, webhook de Telegram, webhook de Supabase, cron diario
- **Base de datos**: Supabase (Postgres + Auth), protegida con Row Level Security — schema en `supabase/`
- **IA**: Claude (`claude-sonnet-4-6`) vía `@anthropic-ai/sdk`, la key solo vive server-side

## Desarrollo local

```bash
npm install
npm run dev
```

Nota: `npm run dev` (Vite) sirve el frontend, pero **no** las funciones de `api/` — esas solo corren desplegadas en Vercel (o localmente con `vercel dev`, que requiere vincular el proyecto por CLI).

## Variables de entorno

Copia `.env.example` a `.env`. Resumen de qué va en cada lado:

**Vercel (Settings → Environment Variables)** — todas las de `.env.example`:
- `ANTHROPIC_API_KEY` — server-side, la usa `api/chat.js`, `api/telegram-webhook.js`, `api/cron-daily-summary.js`.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — frontend (protegido por RLS, seguro exponerlas).
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — server-side, las usan las funciones del bot (bypasan RLS a propósito, no hay sesión de usuario en un webhook).
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET` — bot de Telegram.
- `JARVIS_USER_ID` — tu UUID de Supabase Auth; el bot solo opera sobre estos datos.
- `SUPABASE_WEBHOOK_SECRET` — verifica que las llamadas a `/api/webhook-supabase` vengan de Supabase.
- `GASTO_ALERTA_UMBRAL` — monto (S/) a partir del cual un gasto confirmado dispara aviso instantáneo. Default 300.
- `CRON_SECRET` — Vercel lo manda automático como `Authorization: Bearer <esto>` al llamar el cron.

## El bot de Telegram (sin servidor, 100% serverless)

Arquitectura: Telegram te escribe → **webhook** a `/api/telegram-webhook` (no hay polling, no hay proceso 24/7). El resumen diario corre por **Vercel Cron**. Los avisos en tiempo real (stock=0, pendiente urgente, gasto grande) llegan por **Supabase Database Webhooks** a `/api/webhook-supabase`.

### 1. Crear el bot en Telegram

1. Telegram → **@BotFather** → `/newbot` → nombre + username terminado en `bot`.
2. Guarda el **token** → `TELEGRAM_BOT_TOKEN`.
3. Mándale un mensaje a tu bot, luego abre `https://api.telegram.org/bot<TU_TOKEN>/getUpdates` → busca `"chat":{"id":` → ese número es `TELEGRAM_CHAT_ID`.

### 2. Configurar variables en Vercel y desplegar

Agrega todas las variables de la sección de arriba en Vercel → Settings → Environment Variables, y despliega (push a `master`).

### 3. Registrar el webhook con Telegram

Una sola vez, corre esto (reemplaza los valores):

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<tu-dominio-vercel>/api/telegram-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Debería responder `{"ok":true,"result":true,...}`. Prueba escribiéndole algo al bot por Telegram.

### 4. Supabase Database Webhooks (avisos en tiempo real)

**Integrations → Database Webhooks → Webhooks → Create a new hook**, 3 veces:

| Name | Table | Events |
|---|---|---|
| `jarvis-negocios` | `negocios` | `Update` |
| `jarvis-todos` | `todos` | `Insert` |
| `jarvis-movimientos` | `movimientos` | `Insert` |

Para las 3: **Type** `HTTP Request`, **Method** `POST`, **URL** `https://<tu-dominio-vercel>/api/webhook-supabase`, header `x-webhook-secret` = tu `SUPABASE_WEBHOOK_SECRET`.

### 5. Cron diario

Ya está declarado en `vercel.json` (`/api/cron-daily-summary`, `0 13 * * *` = 8am hora de Lima). Vercel lo activa solo al desplegar — revisa **Settings → Cron Jobs** en el proyecto para confirmarlo.

## Notas

- `server/telegramBrain.js` es una versión server-side de la lógica de tools/prompt de `src/App.jsx`. Si cambias el comportamiento de JARVIS en un lado, revisa si aplica también en el otro.
- Este proyecto migró de un bot corriendo 24/7 en Railway a este modelo 100% serverless para evitar el costo mensual — el trade-off es que el chequeo de vencidos/48h pasó de cada 4h a una vez al día (los avisos urgentes de verdad siguen siendo instantáneos vía webhook).
