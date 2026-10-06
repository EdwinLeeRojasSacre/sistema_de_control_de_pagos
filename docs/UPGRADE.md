# Actualización de versión

El instalador usa un `AppId` estable y realiza una actualización in-place. Detiene los dos servicios, reemplaza únicamente los binarios de `Program Files`, conserva íntegramente `ProgramData`, vuelve a ejecutar migraciones idempotentes y actualiza/reinicia los servicios.

La configuración existente provoca que la inicialización preserve `DATABASE_URL`, `JWT_SECRET`, vouchers y cuentas; el administrador inicial no se vuelve a crear. Antes de actualizar, use el acceso directo **Crear respaldo** y verifique que el nuevo directorio contiene `database.dump`, `vouchers` y `manifest.json`.

Para retroceder, restaure primero los binarios de la versión anterior. Si hubo una migración incompatible, use un respaldo validado y el procedimiento de restauración; bajar solo binarios no revierte el esquema.
