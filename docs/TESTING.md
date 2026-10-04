# Pruebas y validación

## Backend

Desde `backend`:

```bash
npx --no-install prisma validate
npm run lint
npm test
npm run test:e2e
npm run build
```

- `npm test` ejecuta Vitest con el patrón real `**/*.spec.ts`; este patrón también alcanza archivos llamados `*.e2e-spec.ts`.
- `npm run test:e2e` usa `vitest.config.e2e.ts` y ejecuta explícitamente `**/*.e2e-spec.ts`.
- `npm run test:cov` genera cobertura.
- `npm run test:watch` ofrece ejecución interactiva.

Hay tests unitarios de servicios, controladores, DTOs, guards y reglas. `app.e2e-spec.ts` prueba la API con dependencias controladas. Las suites `users-auth-rbac.database.e2e-spec.ts` y `payments-voucher-rules.database.e2e-spec.ts` trabajan contra PostgreSQL real.

## Frontend

Desde `frontend`:

```bash
npm run lint
npm run build
```

No existe actualmente un script de tests frontend ni un framework E2E de navegador versionado. Los flujos visuales y responsive requieren validación manual o automatización externa controlada.

## Aislamiento de datos

Las regresiones de base de datos verifican que `current_database()` sea exactamente `sgpe_dev`, crean identificadores únicos y contienen limpieza posterior. Aun así:

1. use una instancia de desarrollo aislada, nunca producción;
2. tome respaldo antes de ejecutar;
3. no interrumpa el proceso durante su `afterAll`;
4. revise que no queden usuarios, personas, pagos, vouchers o períodos con prefijo de prueba;
5. no ejecute `demo:seed` como parte de la suite normal;
6. asegure que `VOUCHER_STORAGE_PATH` apunte a storage de pruebas cuando se prueben archivos.

Para máxima separación, prepare una copia descartable llamada `sgpe_dev`, ya que las suites bloquean otros nombres de base.

## Interpretación de resultados

Los resultados de una ejecución no son garantía permanente. Registre comando, commit, entorno, base utilizada, aprobados/fallidos y cualquier limpieza realizada. Un build aprobado verifica compilación y tipos, pero no reemplaza pruebas funcionales ni revisión visual.

## Orden recomendado antes de publicar

1. `prisma validate`.
2. lint backend y frontend.
3. tests unitarios.
4. E2E en base aislada.
5. build backend y frontend.
6. revisión manual de login, navegación por rol, pagos, vouchers y exportaciones.
