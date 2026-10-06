# Checklist de producción local

## Antes de distribuir

- [x] Backend, frontend standalone y launcher compilados.
- [x] Node.js 24.20.0 y WinSW 2.12.0 verificados por SHA-256.
- [x] Staging sin `.env` real, `sgpe_dev`, vouchers, dumps ni backups.
- [x] Base descartable, migraciones, admin, login, health y backup validados.
- [x] Config/JWT preservados en actualización idempotente.
- [ ] Firmar Setup y launcher con certificado Authenticode institucional.
- [ ] Ejecutar instalación/upgrade/desinstalación con servicios reales en VM Windows x64 administrativa.
- [ ] Ejecutar prueba de reinicio y arranque automático.
- [ ] Validar visualmente accesos directos, UAC, asistente y mensajes.

## Equipo destino

- [ ] PostgreSQL disponible y credenciales autorizadas para crear la base.
- [ ] Puertos 3000 y 3001 libres.
- [ ] Respaldo externo y procedimiento de recuperación acordados.
- [ ] Custodia y retención de backups definidas por la institución.
