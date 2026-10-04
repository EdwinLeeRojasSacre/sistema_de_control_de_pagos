# Despliegue

Esta guía describe condiciones técnicas; no prescribe proveedor cloud porque el proyecto no tiene uno definido.

## Desarrollo local

- Next.js: `npm run dev`, normalmente en `localhost:3000`.
- NestJS: `npm run start:dev`, por defecto en `localhost:3001`.
- PostgreSQL local o accesible por red privada.
- Vouchers en `backend/storage/vouchers` o `VOUCHER_STORAGE_PATH`.

Consulte [INSTALLATION.md](INSTALLATION.md) para el procedimiento completo.

## Producción

### Componentes

1. Proceso frontend construido con `npm run build` y servido con `npm run start`.
2. Proceso backend construido con `npm run build` y servido con `npm run start:prod`.
3. PostgreSQL administrado y respaldado.
4. Volumen persistente y privado para vouchers.
5. Terminación HTTPS y proxy/reverse proxy si corresponde a la plataforma elegida.

### Variables

- Backend: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `VOUCHER_STORAGE_PATH`.
- Frontend: `NEXT_PUBLIC_API_URL`.

Use un gestor de secretos; no incluya `.env` en imágenes, artefactos o repositorios. `NEXT_PUBLIC_API_URL` es pública por diseño y se integra durante build/runtime de Next.js según el despliegue.

### Preparación

```bash
cd backend
npm ci
npx --no-install prisma validate
npx --no-install prisma generate
npx --no-install prisma migrate deploy
npm run build
```

```bash
cd frontend
npm ci
npm run build
```

Ejecute las migraciones una sola vez por despliegue, con una identidad de base limitada y después de un respaldo. No ejecute `demo:seed`.

### Seguridad de red

- Exponer públicamente solo HTTPS.
- Mantener PostgreSQL y storage fuera del acceso público.
- Generar `JWT_SECRET` largo, aleatorio y distinto por ambiente.
- Restringir CORS al origen real del frontend. El código actual fija `http://localhost:3000`; debe resolverse explícitamente antes de un despliegue no local.
- Aplicar límites de request también en el proxy, considerando el máximo actual de 10 vouchers de 10 MiB.

### Storage y backup

`VOUCHER_STORAGE_PATH` debe apuntar a un volumen persistente, escribible por el backend y no servido directamente por el servidor web. Respaldar conjuntamente:

- PostgreSQL;
- archivos de vouchers;
- configuración de despliegue y secretos mediante el mecanismo seguro elegido.

Una restauración debe mantener coherencia entre filas `vouchers.file_path` y archivos físicos. Pruebe periódicamente restauraciones, no solo creación de backups.

### Operación

- Ejecutar frontend y backend mediante el supervisor de procesos de la plataforma elegida.
- Capturar stdout/stderr sin registrar tokens, contraseñas ni contenido personal.
- Configurar rotación y retención de logs.
- Supervisar disponibilidad HTTP, espacio del volumen, conexiones PostgreSQL y errores de migración.
- Conservar trazabilidad de despliegues y un procedimiento de rollback que no revierta migraciones destructivamente.

### Observabilidad

El backend inicializa `@nestjs/observe`, pero las credenciales del módulo están actualmente como placeholders en código. Antes de usarlo en producción debe definirse una configuración segura; no publique claves reales ni suponga que la telemetría está operativa.

## Lista previa a salida

- Builds y pruebas aprobados en el commit a desplegar.
- CORS ajustado al dominio real.
- HTTPS habilitado.
- Variables y secretos cargados fuera de Git.
- Migraciones y respaldo verificados.
- Storage persistente montado y con permisos mínimos.
- Primera cuenta institucional provisionada de forma controlada.
- Política de logs, backup, restauración y monitoreo aprobada.

