# Pruebas E2E aisladas

La suite E2E del backend exige una base PostgreSQL exclusiva cuyo nombre contenga
`_e2e`. No usa `DATABASE_URL` como alternativa: si falta `DATABASE_URL_E2E`, si
apunta a `sgpe_dev` o a un nombre de produccion, la ejecucion aborta antes de
importar los tests.

Flujo recomendado:

1. Crear una base vacia, por ejemplo `sgpe_local_e2e`.
2. Definir `DATABASE_URL_E2E` con esa base y `?schema=sgpe`.
3. Ejecutar las migraciones con `DATABASE_URL` apuntando temporalmente a la misma
   URL: `npx --no-install prisma migrate deploy`.
4. Ejecutar `npm run test:e2e:seed` para crear solo los roles y cuentas tecnicas
   minimas. Este comando tambien valida el nombre de la base.
5. Definir `VOUCHER_STORAGE_PATH` en un directorio temporal y ejecutar
   `npm run test:e2e`.
6. Eliminar solamente la base y el directorio temporal creados para esa corrida.

Para una prueba descartable de backup/restore se puede ejecutar
`npm run test:e2e:backup-fixture` antes del backup. Agrega un pago, una relacion
APAFA y un PDF controlado; nunca debe ejecutarse contra una base sin `_e2e`.

No se debe usar `demo:seed`, copiar `sgpe_dev` ni compartir almacenamiento de
vouchers con desarrollo o produccion.
