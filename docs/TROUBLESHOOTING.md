# Solución de problemas

- Si el launcher no abre el sistema, compruebe en `services.msc` que ambos servicios estén iniciados y revise `C:\ProgramData\SistemaControlPagos\logs`.
- Si el backend no inicia, valide que PostgreSQL esté activo y que el usuario configurado conserve acceso a la base.
- Si los puertos 3000 o 3001 están ocupados, identifique el proceso antes de reinstalar; no finalice procesos ajenos a la aplicación.
- Si falla un respaldo, confirme que `POSTGRESQL_BIN` en `backend.env` apunte a la carpeta que contiene `pg_dump.exe` y revise el Historial del Programador de tareas.
- Si el instalador no es reconocido por Windows, valide su SHA-256. La versión de validación interna no está firmada; la distribución final requiere firma Authenticode institucional.

No publique `backend.env`, logs del instalador con información local ni volcados de base de datos al solicitar soporte.
