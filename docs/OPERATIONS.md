# Operación local en Windows

Windows inicia automáticamente ambos servicios. El usuario abre **Sistema de Control de Pagos**; el launcher recupera servicios detenidos cuando los permisos lo permiten, espera backend/frontend y abre el login. No se requieren comandos.

- Servicios: `SistemaControlPagosBackend` y `SistemaControlPagosFrontend`.
- Health: `http://127.0.0.1:3001/health`.
- Logs: `C:\ProgramData\SistemaControlPagos\logs\backend` y `frontend`.
- Configuración: `C:\ProgramData\SistemaControlPagos\config\backend.env`.
- Vouchers: `C:\ProgramData\SistemaControlPagos\storage\vouchers`.

No edite la base y vouchers por separado, no ejecute `demo:seed` y no finalice procesos `node.exe` genéricos. Ante un incidente, revise health/logs, confirme PostgreSQL y genere un respaldo antes de reparar.

El administrador inicial se solicita durante una instalación limpia. La contraseña no se pasa en argumentos ni se registra, y el bootstrap no se repite si existe un ADMINISTRADOR activo.
