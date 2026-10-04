# Backend — Sistema de Control de Pagos

API REST de la versión 1.0.0 del Sistema de Control de Pagos de la I.E.I. Cuna Jardín N.° 85 “María Inmaculada Concepción” — Chancay.

Está construida con NestJS, Prisma y PostgreSQL. Centraliza autenticación, autorización por roles, familias, matrículas, pagos, vouchers, períodos escolares, reportes y auditoría.

## Configuración

Copie `.env.example` como `.env` y complete valores locales seguros. No publique el archivo `.env`.

```bash
npm ci
npx --no-install prisma generate
npx --no-install prisma migrate deploy
npm run start:dev
```

## Comandos principales

```bash
npm run lint
npm test
npm run test:e2e
npm run build
npm run start:prod
```

Los E2E que usan PostgreSQL están protegidos para ejecutarse únicamente contra una base cuyo nombre sea `sgpe_dev`; crean y eliminan datos temporales.

## Documentación

- [Descripción general](../README.md)
- [Instalación](../docs/INSTALLATION.md)
- [Arquitectura](../docs/ARCHITECTURE.md)
- [Base de datos](../docs/DATABASE.md)
- [Pruebas](../docs/TESTING.md)
- [Despliegue](../docs/DEPLOYMENT.md)

La licencia del proyecto aún no ha sido definida por su propietario.
