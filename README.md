# Casa Paella — CRM & Automatización WhatsApp

CRM web para el restaurante español **Casa Paella** (Bogotá / Cali / Colombia).
Captura leads desde el sitio web, gestiona clientes, automatiza mensajes
de WhatsApp transaccionales y de marketing.

> **Stack:** Next.js 15 (App Router) · React 19 · Drizzle ORM · MySQL · Auth.js v5 · Baileys (dev) / Meta Cloud API (prod) · Tailwind CSS.

---

## 1. Setup local

### 1.1 Requisitos
- Node.js 20+ (probado en Node 24)
- MySQL 8 local o accesible
- Un celular con WhatsApp (para la sesión Baileys)

### 1.2 Instalar y configurar
```bash
cd D:\desarrollos\CRMCasaPaella
npm install
cp .env.example .env
# Edita .env y rellena DATABASE_URL
```

### 1.3 Crear la base de datos
1. Inicia sesión en MySQL local o phpMyAdmin.
2. Crea la base de datos: `CREATE DATABASE crm_casa_paella CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
3. Importa el schema: ejecuta el contenido de `drizzle/0000_init.sql`.

(O usa Drizzle: `npm run db:push` — esto aplica el schema directamente.)

### 1.4 Arrancar
```bash
npm run dev
```

Abre `http://localhost:3000`. El primer arranque:
- Crea el usuario admin (imprime la contraseña `admin1234` en la consola **una sola vez**).
- Inicia Baileys. Ve a **WhatsApp** en el sidebar → escanea el QR con el celular del restaurante.

### 1.5 Probar el webhook
```bash
curl -X POST http://localhost:3000/api/webhook/lead \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Juan Pérez",
    "phone": "+57 313 881 8822",
    "email": "juan@example.com",
    "source": "web_reservation",
    "reservationDate": "2026-08-15T19:30:00-05:00",
    "guests": 4
  }'
```

Deberías ver el cliente en `/customers` y el mensaje en `/messages`.

### 1.6 Notas sobre el dev server

- **Server-only modules (mysql2, bcryptjs, sharp, baileys):** el dev server de Next.js webpack intenta bundlear todo para el cliente. Para evitar errores, la instrumentación NO importa estos módulos en boot — el primer admin se crea vía el primer login, y el campaign worker corre lazy en la primera campaña. En PRODUCCIÓN (Hostinger con `output: standalone`) no hay este problema.
- **Campaign worker en dev:** el cron que procesa campañas programadas y continúa envíos grandes está deshabilitado en dev (Next.js dev no puede bundlear `node-cron` + `mysql2` + `baileys` juntos). El botón "Enviar ahora" en `/campaigns/[id]` procesa el primer batch de 5 mensajes de forma sincrónica; para batches adicionales, refrescá la página y volvé a hacer click. En prod el worker corre solo.
- **WhatsApp QR:** visitá `/whatsapp` después de loguearte para ver el QR. Escaneá desde el celular del restaurante (WhatsApp → ⋮ → Dispositivos vinculados → Vincular un dispositivo).

---

## 2. Estructura del proyecto

```
CRMCasaPaella/
├── drizzle/
│   ├── schema.ts              # Schema TypeScript (source of truth)
│   └── 0000_init.sql          # DDL MySQL listo para phpMyAdmin
├── scripts/
│   ├── prepare-deploy.mjs     # Build + bundle para Hostinger
│   └── strip-breakpoints.mjs  # Fix SQL para mysql CLI
├── src/
│   ├── app/
│   │   ├── login/             # Form de login
│   │   ├── (dashboard)/       # Rutas protegidas
│   │   │   ├── dashboard/     # KPIs
│   │   │   ├── customers/     # Lista + detalle
│   │   │   ├── reservations/  # Lista
│   │   │   ├── orders/        # Lista
│   │   │   ├── campaigns/     # Lista (Fase 2: builder)
│   │   │   ├── messages/      # Log de WhatsApp
│   │   │   └── whatsapp/      # Estado + QR
│   │   └── api/
│   │       ├── auth/          # Auth.js v5 handlers
│   │       ├── webhook/lead/  # ← el endpoint que llama tu sitio
│   │       ├── webhook/whatsapp/  # Verificación Meta
│   │       └── whatsapp/status/
│   ├── lib/
│   │   ├── db.ts              # Pool mysql2 (con fix localhost)
│   │   ├── auth.ts            # Auth.js v5 config
│   │   ├── env.ts             # Validación con Zod
│   │   ├── phone.ts           # Normalización +57…
│   │   └── whatsapp/          # Abstracción Baileys / Meta
│   ├── server/                # Queries de DB
│   └── components/dashboard/
├── instrumentation.ts         # Hook de Next.js: seed + WA init al boot
├── next.config.ts             # Workarounds Hostinger shared
└── server.js                  # Entry dev
```

---

## 3. Deploy en Hostinger Shared

### 3.1 En hPanel

1. **Crear la base de datos MySQL** (Bases de datos → MySQL). Anota:
   - host (`127.0.0.1`)
   - database name
   - username
   - password

2. **Importar el schema**:
   - phpMyAdmin → selecciona la DB → Importar → sube `drizzle/0000_init.sql`.

3. **Activar Node.js** (Avanzado → Node.js):
   - Versión: 20 o 22
   - Entry point: `dist/server.js` (lo definiremos en el siguiente paso)
   - Application root: la ruta donde subirás el proyecto (ej. `~/domains/casapaella.com.co/crm`)

### 3.2 Build del bundle

En tu máquina local:
```bash
npm install
npm run build              # Genera .next/standalone
npm run deploy:prepare     # Empaqueta todo en ./dist
```

`deploy:prepare` produce un directorio `dist/` con:
- `server.js` (con env-loader inyectado al inicio)
- `.next/` (con los chunks estáticos)
- `auth_artifacts/` (la sesión Baileys, si ya la tienes)
- `node_modules/` (mínimo necesario)
- `.env.production` (basado en `.env.example` — **edita con tus credenciales reales**)

### 3.3 Subir a Hostinger

Opción A — **File Manager (hPanel)**:
- Comprime `dist/` en `dist.zip`
- Sube a `~/domains/casapaella.com.co/crm/` (o donde apuntes el subdominio)
- Extrae in-place
- Borra `dist.zip`

Opción B — **FTP/SFTP** con FileZilla o similar:
- Sube el contenido de `dist/` recursivamente.

### 3.4 Variables de entorno en producción

Edita `dist/.env.production` directamente en el File Manager:
```env
NODE_ENV=production
APP_URL=https://crm.casapaella.com.co
AUTH_SECRET=<32+ chars random>

DATABASE_URL=mysql://USUARIO:PASSWORD@127.0.0.1:3306/NOMBRE_DB

WHATSAPP_PROVIDER=baileys        # o 'meta' cuando Meta apruebe
BAILEYS_SESSION_DIR=./auth_artifacts/baileys

SEED_ADMIN_EMAIL=admin@casapaella.com.co
```

> ⚠ **Importante:** usa `127.0.0.1` en la URL, NO `localhost`. En Hostinger
> shared, `localhost` puede resolver a `::1` (IPv6) y romper el grant de MySQL.

> ⚠ Genera `AUTH_SECRET` con: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

### 3.5 Primer arranque

1. En hPanel → Node.js → **Restart** la aplicación.
2. Abre `https://crm.casapaella.com.co/login`.
3. Mira los **logs de la app** (hPanel → Node.js → Logs) — deberías ver:
   ```
   [db] pool initialized → mysql://...
   [boot] instrumentation: seeding admin + initializing WhatsApp
   ┌─────────────────────────────────────┐
   │  ✓ Admin user created               │
   │    Email: admin@casapaella.com.co   │
   │    Password: admin1234              │
   └─────────────────────────────────────┘
   [whatsapp] provider = baileys
   [baileys] new QR code available — open /whatsapp in the dashboard
   ```
4. Loguéate con `admin@casapaella.com.co` / `admin1234`. **Cámbiala inmediatamente** (en un release posterior agregamos un endpoint `POST /api/auth/change-password`; por ahora edita la DB directamente).
5. Ve a **WhatsApp** → escanea el QR con el celular del restaurante.

### 3.6 Redespliegues

Cada vez que cambies código:
1. `npm run deploy:prepare` local
2. Sube el nuevo `dist/` (sobrescribe, pero **no borres `auth_artifacts/`** — eso preserva la sesión Baileys)
3. Restart en hPanel

Si solo cambiaste `.env.production`, edita el archivo directamente y haz restart — no necesitas redesplegar código.

---

## 4. Cambiar de Baileys a Meta Cloud API (producción real)

1. Crea una cuenta en [business.facebook.com](https://business.facebook.com).
2. Verifica tu negocio.
3. Crea una app en [developers.facebook.com](https://developers.facebook.com) → tipo **Business**.
4. Agrega el producto **WhatsApp**.
5. En WhatsApp Manager:
   - Verifica el número (+57 313 881 8822) o porta el número actual.
   - Crea las plantillas de mensaje (necesitan aprobación 24-48h):
     - `casapaella_reserva_confirmada` — utility template, con variables `{{1}}` (nombre), `{{2}}` (fecha), `{{3}}` (hora), `{{4}}` (comensales).
     - `casapaella_pedido_recibido` — utility, con `{{1}}` (nombre), `{{2}}` (total).
     - `casapaella_promocion` — marketing template, con `{{1}}` (nombre), `{{2}}` (cuerpo).
6. Genera un **System User Access Token** permanente.
7. Configura el webhook en Meta apuntando a `https://crm.casapaella.com.co/api/webhook/whatsapp`, con verify token = `META_WA_WEBHOOK_VERIFY_TOKEN`.
8. Llena en `.env.production`:
   ```
   WHATSAPP_PROVIDER=meta
   META_WA_PHONE_NUMBER_ID=...
   META_WA_BUSINESS_ACCOUNT_ID=...
   META_WA_ACCESS_TOKEN=...
   META_WA_WEBHOOK_VERIFY_TOKEN=...
   ```
9. Restart. Listo.

El resto del código no cambia. La capa de abstracción `src/lib/whatsapp/` aísla el provider.

---

## 5. Endpoints principales

| Método | Ruta                          | Auth | Descripción                              |
|--------|-------------------------------|------|------------------------------------------|
| POST   | `/api/webhook/lead`           | Secret opcional | Captura reserva/pedido desde el sitio |
| GET    | `/api/whatsapp/status`        | Auth | Estado + QR del provider               |
| GET    | `/api/webhook/whatsapp`       | Meta | Verificación del webhook de Meta       |
| POST   | `/api/webhook/whatsapp`       | Meta | Mensajes entrantes + status updates    |
| GET    | `/api/auth/csrf`              | —    | CSRF token para login                   |
| POST   | `/api/auth/callback/credentials` | — | Login (form post)                  |

---

## 6. Fases siguientes (roadmap)

- [x] **Fase 2:** Formularios de creación de reservas/pedidos en el dashboard
- [x] **Fase 2:** Builder de campañas (segmentación + programación + envío)
- [x] **Fase 2:** Worker de campañas con rate limit (1 msg/seg)
- [x] **Fase 2:** Charts (revenue 30 días, KPIs)
- [x] **Fase 2:** Endpoint `POST /api/auth/change-password`
- [x] **Fase 3:** Auto-tagging (Frecuente, VIP, Inactivo, Cliente Nuevo) + daily refresher
- [x] **Fase 3:** Templates versionados en DB (no más hardcoded)
- [x] **Fase 3:** Webhook inbound de Meta — status updates sent/delivered/read/failed
- [x] **Fase 3:** Exportes CSV (clientes, pedidos, destinatarios de campaña)
- [x] **Fase 3:** UI de edición de plantillas (`/templates`)
- [ ] **Fase 4:** Multi-sucursal (Zona G, Santafé, Unicentro, etc.)
- [ ] **Fase 4:** Integración con el POS para sincronizar pedidos en tiempo real
- [ ] **Fase 4:** Reportes programados (email semanal al dueño)
- [ ] **Fase 4:** Respuestas automáticas a palabras clave ("CANCELAR", "INFO", etc.)

---

## 7. Soporte de la marca (paleta)

```
Granate (primary)  #C1272D   — paella, vino, tradición
Dorado  (accent)   #C9A961   — elegancia, premium
Crema   (bg)       #FAF3E0   — cálido, artesanal
Azafrán (highlight)#E89A1F   — el color del azafrán
Carbón  (dark bg)  #1A1410   — modo noche
```

Definidos en `tailwind.config.ts`. Cambia los valores y todo el dashboard se reestila.
