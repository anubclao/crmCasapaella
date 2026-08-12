# Deploy a Hostinger (Node.js Web App)

Checklist paso a paso. Asume que ya compraste el hosting Node.js y tenés acceso al **hPanel**.

---

## 0. Pre-requisitos

- Dominio o subdominio apuntando a Hostinger (ej: `crm.casapaella.com.co`).
- Repo en GitHub: `https://github.com/anubclao/crmCasapaella` (vacío por ahora).
- Token de GitHub con scope `repo` (o fine-grained `Contents: Read+Write`).
- Base de datos MySQL creada en hPanel.

---

## 1. Crear la base de datos en Hostinger

1. hPanel → **Databases** → **MySQL Databases** → **Create new database**.
2. Anotar:
   - **Database name** (ej: `u123456_crmcasapaella`)
   - **Username** (ej: `u123456_admin`)
   - **Password** (anotalo; lo necesitás en `DATABASE_URL`)
   - **Host** (casi siempre `127.0.0.1`)
   - **Port** (`3306`)

3. Abrir **phpMyAdmin** desde el panel.
4. Seleccionar la base recién creada.
5. Pestaña **SQL** → pegar todo el contenido de [drizzle/HOSTINGER_schema.sql](drizzle/HOSTINGER_schema.sql) → **Go**.

✅ Verificar que las 9 tablas existan (`users`, `customers`, `tags`, `customer_tags`, `reservations`, `orders`, `campaigns`, `message_templates`, `messages`).

---

## 2. Push del código a GitHub (sin exponer el token)

> ⚠ **No pegues el token en el chat del IDE** — GitHub invalida tokens que se filtran a canales/logs.

```powershell
# 1. Crear el archivo de token (vos lo pegás, el IDE nunca lo ve)
cd D:\desarrollos\CRMCasaPaella
notepad .git-token
# → Pegar el token, guardar y cerrar.
#   Asegurate de que el archivo NO termine con newline (el script lo trim).

# 2. Asegurate de que el remote apunte al repo correcto
git remote -v
# Debería decir: origin  https://github.com/anubclao/crmCasapaella.git

# 3. Primer commit + push
.\scripts\push-with-creds.ps1
```

El script:

- Lee el token de `.git-token`.
- Valida contra la API de GitHub (si es inválido aborta).
- Hace `git add -A` → `git commit` → `git push -f origin main` (el `-f` es seguro en repo vacío).
- **Borra** el archivo `.git-token` al final.

🔒 **Después del push, revocá el token en https://github.com/settings/tokens**.

---

## 3. Configurar la Web App en Hostinger

1. hPanel → **Web Apps** → **Setup Node.js App** (o similar, el botón puede decir "Create Node.js App").
2. Configurar:
   | Campo | Valor |
   |---|---|
   | **Application root** | `crm-casapaella` (o el nombre que quieras) |
   | **Application URL** | el subdominio (ej: `crm.casapaella.com.co`) |
   | **Application startup file** | `dist/server.js` (ver paso 4) |
   | **Node.js version** | 20.x o 22.x |
   | **Package manager** | `npm` |
   | **Application mode** | `production` |

3. **Conectar el repo GitHub**:
   - En el panel, "Connect to Git" → seleccionar `anubclao/crmCasapaella`, branch `main`.
   - O más simple: SSH al servidor y `git clone` manualmente (ver paso alternativo al final).

---

## 4. Build del bundle (en tu máquina local, antes de subir)

```powershell
cd D:\desarrollos\CRMCasaPaella
npm install
npm run build
npm run deploy:prepare
```

Esto produce un directorio `dist/` con todo lo necesario. Subilo a Hostinger:

**Opción A — File Manager (hPanel):**

1. Comprimir `dist/` a `dist.zip`.
2. hPanel → File Manager → en la raíz de la app, **Upload** → `dist.zip`.
3. Click derecho → **Extract** → todo queda en `dist/`.
4. Borrar el `.zip`.

**Opción B — FTP/SFTP** (con FileZilla o similar):

- Host: el que te da Hostinger
- Subir el contenido de `dist/` (no la carpeta, sus archivos).

**Opción C — SSH + git clone (recomendado para updates):**

```bash
ssh usuario@tu-servidor.hostinger.com
cd ~
git clone https://github.com/anubclao/crmCasapaella.git app
cd app
npm install
npm run build
npm run deploy:prepare
```

---

## 5. Variables de entorno

En hPanel → tu Web App → **Environment variables**, agregar (o subir el archivo `.env.production` al root):

```
NODE_ENV=production
APP_URL=https://crm.casapaella.com.co
AUTH_SECRET=<el del .env.production.example>
DATABASE_URL=mysql://USER:PASS@127.0.0.1:3306/DBNAME
WHATSAPP_PROVIDER=baileys
BAILEYS_SESSION_DIR=./auth_artifacts/baileys
RESTAURANT_NAME=Casa Paella
RESTAURANT_PHONE=+573138818822
RESTAURANT_TIMEZONE=America/Bogota
DEFAULT_COUNTRY_CODE=+57
SEED_ADMIN_EMAIL=admin@casapaella.com.co
```

> El `AUTH_SECRET` ya está en [.env.production.example](.env.production.example) — **regeneralo para tu deploy**:
>
> ```powershell
> node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
> ```

---

## 6. Arrancar la app

En hPanel → tu Web App → **Restart**. Los logs quedan en el panel.

**Primer arranque**:

- El hook de `instrumentation.ts` detecta que no existe el admin y lo crea con password `admin1234`.
- **CAMBIAR LA CONTRASEÑA INMEDIATAMENTE** vía `/settings` o `/users` → editar admin.

**WhatsApp** (si usás Baileys):

- Entrar a `/whatsapp` en el dashboard.
- Escanear el QR desde el celular del restaurante.
- La sesión queda en `auth_artifacts/baileys/`. **Backup obligatorio** (si se pierde, hay que re-escanear).

---

## 7. SSL y dominio

Hostinger suele incluir SSL automático (Let's Encrypt) para los dominios asignados. Si no:

- hPanel → **SSL** → **Install Free SSL** → esperar 5-10 min.

---

## 8. Updates futuros (CI/CD manual)

```powershell
# Local
git add -A
git commit -m "feat: ..."
notepad .git-token       # pegar nuevo token
.\scripts\push-with-creds.ps1
# revocar token en github

# Hostinger
# Opción SSH:
ssh ...
cd ~/app && git pull && npm run build && npm run deploy:prepare && touch dist/server.js  # restart

# Opción panel: hPanel → Web App → "Pull & Deploy" (si está conectado a GitHub)
```

---

## Troubleshooting

| Error                                     | Causa probable                       | Fix                                                                                                 |
| ----------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `ECONNREFUSED 127.0.0.1:3306`             | DB host mal                          | Usar el host del panel, no `localhost`                                                              |
| `Access denied for user`                  | User/pass mal en `DATABASE_URL`      | Verificar en phpMyAdmin que el user existe                                                          |
| `Module not found: Can't resolve 'sharp'` | Standalone incompleto                | `next.config.ts` ya tiene `outputFileTracingIncludes`; si pasa, `npm run deploy:prepare` lo arregla |
| `Invalid AUTH_SECRET`                     | Falta variable o < 32 chars          | Regenerar y pegar completo                                                                          |
| `EADDRINUSE` al arrancar                  | Otro proceso en el mismo puerto      | Matar el anterior desde hPanel o reiniciar la app                                                   |
| Página en blanco después de login         | `output: standalone` faltó `public/` | Copiar `public/` dentro de `dist/public/`                                                           |

---

## Estructura final del deploy

```
~/domains/crm.casapaella.com.co/
├── dist/                    ← bundle (de npm run deploy:prepare)
│   ├── server.js            ← entry point (con env loader inyectado)
│   ├── .next/
│   ├── auth_artifacts/      ← sesión Baileys (backup!)
│   ├── public/              ← logoNew.png, etc.
│   └── node_modules/        ← deps ya copiadas (standalone)
├── .env.production          ← variables de entorno
└── (logs)
```
