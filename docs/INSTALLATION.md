# Instalación

Guía de desarrollo local del Sistema de Control de Pagos 1.0.0.

## Prerrequisitos

- Git.
- Node.js **20.9 o superior** (mínimo declarado por Next.js 16.3.4).
- npm.
- PostgreSQL accesible desde el equipo.

El repositorio no declara una versión mínima concreta de PostgreSQL. El esquema utiliza UUID con `gen_random_uuid()`, JSONB, índices y restricciones relacionales.

## 1. Obtener el código

```bash
git clone <URL_DEL_REPOSITORIO>
cd SGPE
```

## 2. Preparar PostgreSQL

Cree una base vacía para desarrollo y un usuario con permisos sobre ella. No reutilice una base productiva. Prisma trabaja en el esquema `sgpe`, indicado en `DATABASE_URL`.

## 3. Configurar el backend

```bash
cd backend
npm ci
```

Copie `backend/.env.example` como `backend/.env` y reemplace los valores de ejemplo. Variables:

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión PostgreSQL utilizada por Prisma. |
| `JWT_SECRET` | Firma y validación de JWT; es obligatoria. |
| `PORT` | Puerto HTTP; si se omite, usa `3001`. |
| `VOUCHER_STORAGE_PATH` | Directorio persistente de vouchers; si se omite, usa `backend/storage/vouchers`. |

Nunca confirme el archivo `.env` en Git.

Valide y prepare Prisma:

```bash
npx --no-install prisma validate
npx --no-install prisma generate
npx --no-install prisma migrate deploy
```

Las migraciones crean y evolucionan el esquema. El script `demo:seed` existe para desarrollo controlado, pero no forma parte de la instalación normal ni debe ejecutarse sobre datos reales.

Inicie la API:

```bash
npm run start:dev
```

La ruta raíz debe responder en `http://localhost:3001/`. Actualmente su respuesta básica es `Hello World!`.

## 4. Configurar el frontend

En otra terminal:

```bash
cd frontend
npm ci
```

Copie `frontend/.env.example` como `frontend/.env.local`. `NEXT_PUBLIC_API_URL` debe apuntar a la API accesible desde el navegador.

```bash
npm run dev
```

Abra `http://localhost:3000/login`.

## 5. Compilación de producción local

```bash
cd backend
npm run build
npm run start:prod
```

```bash
cd frontend
npm run build
npm run start
```

`start:prod` del backend requiere haber generado antes `dist`; `start` del frontend requiere `.next`.

## Comprobaciones

- API levantada en el puerto configurado.
- Frontend capaz de consultar `GET /support/public` y mostrar el login.
- Migraciones aplicadas sin errores.
- Directorio de vouchers escribible por el proceso backend.
- Cuenta institucional provisionada por un procedimiento controlado; las migraciones no crean credenciales operativas.

## Problemas comunes

| Síntoma | Revisión |
| --- | --- |
| Falla al iniciar por `JWT_SECRET` | Configure una clave larga y aleatoria en `backend/.env`. |
| Prisma no conecta | Revise host, puerto, base, usuario, contraseña y `schema=sgpe` en `DATABASE_URL`. |
| Error CORS | En el código actual el backend admite `http://localhost:3000`; otro origen requiere configuración de despliegue. |
| El frontend no llega a la API | Revise `NEXT_PUBLIC_API_URL` y reinicie Next.js tras cambiarla. |
| No se puede abrir un voucher | Compruebe `VOUCHER_STORAGE_PATH`, permisos y persistencia del archivo físico. |
| `next/font` falla en build | El build necesita acceso a Google Fonts mientras se mantenga la configuración actual de Geist. |

