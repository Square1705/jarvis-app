# JARVIS — bot de Telegram

Servicio Node persistente (no serverless) que:

- Te manda un **resumen diario** por Telegram (hora configurable, default 8am Lima).
- Te avisa de **pendientes vencidos o a 48h de vencer** (cron cada 4h), y cuando el **stock de Ray-Ban/iPhones llega a 0**.
- Te avisa **al instante** (no en 4h) cuando: se acaba el stock, creas un pendiente de prioridad alta, o registras un gasto confirmado grande — vía Supabase Database Webhooks.
- Te avisa si llevas **más de 2 días sin abrir la app**.
- **Te responde por Telegram** — puedes hablarle igual que en la web, comparte la misma conversación (`chat_messages` en Supabase), así que es continuo entre ambos.
- Expone `/health` para que un monitor externo (ej. UptimeRobot) te avise si el bot se cae.

Solo responde al `TELEGRAM_CHAT_ID` configurado — cualquier otro chat que le escriba es ignorado.

## 1. Crear el bot en Telegram

1. Abre Telegram, busca **@BotFather**.
2. Mándale `/newbot`, ponle un nombre (ej. "Jarvis Gonzalo") y un username único terminado en `bot` (ej. `gonzalo_jarvis_bot`).
3. BotFather te da un **token** — guárdalo, es tu `TELEGRAM_BOT_TOKEN`.

## 2. Obtener tu chat_id

1. Busca tu bot recién creado en Telegram y mándale cualquier mensaje (ej. "hola").
2. Abre en el navegador: `https://api.telegram.org/bot<TU_TOKEN>/getUpdates` (reemplaza `<TU_TOKEN>`).
3. Busca `"chat":{"id":` en la respuesta — ese número es tu `TELEGRAM_CHAT_ID`.

## 3. Obtener las credenciales de Supabase para el bot

1. En tu proyecto de Supabase: **Settings → API → Secret keys** — copia la **service_role key** (⚠️ nunca la pongas en el frontend, solo aquí).
2. **Authentication → Users** — copia el **UUID** de tu usuario (tu cuenta de la app) → eso es `JARVIS_USER_ID`.
3. `SUPABASE_URL` es la misma URL del proyecto que ya usas en la app (`VITE_SUPABASE_URL`).

## 4. Variables de entorno

Copia `.env.example` a `.env` y completa los valores (para probar local). En Railway, las agregas en Settings → Variables del servicio.

## 5. Probar local

```bash
npm install
npm start
```

Debería mandarte un mensaje de "🤖 JARVIS bot conectado" a tu Telegram.

## 6. Desplegar en Railway

1. Ve a **railway.app**, inicia sesión con GitHub.
2. **New Project → Deploy from GitHub repo** → selecciona tu repo `jarvis-app`.
3. Como el repo tiene el bot en una subcarpeta, en **Settings** del servicio:
   - **Root Directory**: `telegram-bot`
   - **Start Command**: `npm start` (debería detectarlo solo)
4. En **Variables**, agrega las 6-7 variables de `.env.example` con tus valores reales.
5. Deploy. Railway mantiene el proceso corriendo 24/7 (a diferencia de Vercel, que es serverless) — necesario porque el bot escucha mensajes todo el tiempo y corre cron jobs.
6. Revisa los **Logs** del servicio para confirmar que dice "JARVIS Telegram bot iniciando..." y no hay errores.
7. En **Settings → Networking**, click **Generate Domain** para que Railway te dé una URL pública (ej. `jarvis-bot-production.up.railway.app`). La necesitas para los pasos 7 y 8.

## 7. Avisos en tiempo real (Supabase Database Webhooks)

Esto hace que el bot te avise al instante en vez de esperar el cron de 4h.

1. En Supabase: **Database → Webhooks → Create a new webhook**.
2. Crea uno para cada caso (puedes repetir estos pasos 3 veces):
   - **Nombre**: `jarvis-negocios` | **Tabla**: `negocios` | **Eventos**: `Update`
   - **Nombre**: `jarvis-todos` | **Tabla**: `todos` | **Eventos**: `Insert`
   - **Nombre**: `jarvis-movimientos` | **Tabla**: `movimientos` | **Eventos**: `Insert`
3. Para los 3: **Type** = `HTTP Request`, **Method** = `POST`, **URL** = `https://<tu-dominio-railway>/webhook/supabase`.
4. En **HTTP Headers**, agrega: `x-webhook-secret` = el mismo valor que pusiste en `WEBHOOK_SECRET` en Railway.
5. Guarda los 3. Prueba registrando un pendiente de prioridad alta desde la app — deberías recibir el aviso por Telegram en segundos.

## 8. Monitoreo (opcional pero recomendado)

1. Crea una cuenta gratis en **uptimerobot.com**.
2. **Add New Monitor** → HTTP(s) → URL: `https://<tu-dominio-railway>/health` → intervalo cada 5 min.
3. Configura que te avise por correo (o Telegram, UptimeRobot también tiene esa integración) si el bot deja de responder.

## Notas

- La lógica de tools/prompt (`lib/brain.js`) es una versión adaptada de `src/App.jsx` del frontend. Si cambias el comportamiento de JARVIS en un lado, probablemente quieras replicarlo en el otro.
- El bot usa la **service_role key** de Supabase (bypassa Row Level Security) porque corre en un servidor de confianza sin sesión de usuario. Por eso es crítico que `TELEGRAM_CHAT_ID` esté bien configurado — es la única barrera que evita que alguien más use el bot para ver/editar tus datos.
