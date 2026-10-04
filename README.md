# Sistema de Control de Pagos

Aplicación web institucional para centralizar el registro familiar, las matrículas, los pagos de APAFA y Taller, sus vouchers y los reportes de seguimiento de la I.E.I. Cuna Jardín N.° 85 “María Inmaculada Concepción” — Chancay.

El sistema reemplaza controles dispersos por una fuente única con trazabilidad, reglas de integridad, acceso por roles y conservación del historial por período escolar.

**Versión actual:** 1.0.0

## Funcionalidades

- Autenticación JWT, cambio obligatorio de contraseña y cierre por inactividad.
- Administración de usuarios de Secretaría y Dirección.
- Períodos escolares `PLANIFICADO`, `ABIERTO` y `CERRADO`.
- Estructura académica por período: ciclos, niveles, turnos y aulas.
- Registro e importación de familias y matrículas.
- Pagos de APAFA por familia y Taller por estudiante.
- Carga, consulta y asociación de vouchers a conceptos pagados.
- Reportes y exportaciones XLSX/PDF con filtros académicos y de pago.
- Auditoría de operaciones sensibles.

## Roles

| Rol | Alcance principal |
| --- | --- |
| `ADMINISTRADOR` | Operación general, configuración académica y gestión de usuarios `SECRETARIA`/`DIRECCION`. |
| `SECRETARIA` | Familias, matrículas, pagos, reportes, períodos, aulas y usuarios `DIRECCION`. |
| `DIRECCION` | Consulta de reportes y exportaciones. |

## Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS y Axios.
- **Backend:** NestJS, TypeScript estricto, REST, JWT/Passport y RBAC.
- **Persistencia:** PostgreSQL y Prisma 6.16.2.
- **Pruebas:** Vitest y Supertest.

## Arquitectura

```text
Navegador / Next.js → API REST NestJS → Prisma → PostgreSQL
                                  ↘ almacenamiento local de vouchers
```

El frontend conserva la sesión en `sessionStorage`; la API valida cada JWT y el estado actual de usuario, persona y rol. Las reglas de negocio y autorización se aplican en el backend.

## Estructura del repositorio

```text
backend/          API, Prisma, migraciones, tests y storage runtime
frontend/         aplicación Next.js
docs/             documentación funcional y técnica
database/         scripts locales heredados; revisar antes de publicar
```

## Requisitos básicos

- Node.js 20.9 o superior.
- npm y una instancia PostgreSQL accesible.
- Variables de entorno creadas desde los archivos `.env.example`.

## Instalación resumida

```bash
cd backend
npm ci
npx --no-install prisma generate
npx --no-install prisma migrate deploy
npm run start:dev
```

En otra terminal:

```bash
cd frontend
npm ci
npm run dev
```

Por defecto, el frontend usa `http://localhost:3000` y la API `http://localhost:3001`.

## Validación

```bash
cd backend
npx --no-install prisma validate
npm run lint
npm test
npm run test:e2e
npm run build

cd ../frontend
npm run lint
npm run build
```

Los E2E con base de datos crean información temporal y contienen una protección explícita para `sgpe_dev`; use una base de desarrollo aislada y con respaldo.

## Documentación

- [Instalación](docs/INSTALLATION.md)
- [Manual de usuario](docs/USER_MANUAL.md)
- [Requisitos](docs/REQUIREMENTS.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Base de datos](docs/DATABASE.md)
- [Reglas de negocio](docs/BUSINESS_RULES.md)
- [Pruebas](docs/TESTING.md)
- [Despliegue](docs/DEPLOYMENT.md)
- [Historial de cambios](CHANGELOG.md)

La licencia del proyecto aún no ha sido definida por su propietario.
