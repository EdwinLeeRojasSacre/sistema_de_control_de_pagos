# Instalador Windows

El paquete `SistemaControlPagos-Setup-1.0.0.exe` instala una aplicación local x64 con backend y frontend como servicios automáticos de Windows. Incluye Node.js 24 LTS y WinSW; requiere una instalación PostgreSQL existente.

## Distribución

- Aplicación y runtime: `C:\Program Files\Sistema de Control de Pagos`.
- Configuración, vouchers, logs y backups: `C:\ProgramData\SistemaControlPagos`.
- Servicios: `SistemaControlPagosBackend` y `SistemaControlPagosFrontend`, ejecutados como `LocalService`.
- Tarea diaria: `SistemaControlPagosBackup`, a las 02:00 como `SYSTEM` (configurable con `/BACKUP_TIME=HH:mm`).

El instalador crea la base si no existe, ejecuta `prisma migrate deploy` y provisiona el primer ADMINISTRADOR solo cuando aún no existe uno. No ejecuta seeds de demostración. `backend.env` contiene los secretos generados y queda limitado a Administradores, SYSTEM y lectura para LocalService.

## Compilación reproducible

Ejecute `installer/build/Build-Installer.ps1`. El script valida las huellas declaradas en `installer/vendor-manifest.json`, reconstruye el staging, compila el launcher y llama a Inno Setup. La salida local queda en `installer/output` y no se versiona.

La insignia institucional PNG permanece intacta; el icono ICO se deriva durante el build. El launcher comprueba ambos endpoints, intenta recuperar servicios detenidos, espera su disponibilidad y abre el login sin mostrar secretos.

## Firma

La distribución institucional debe firmar el instalador y el launcher con un certificado de firma de código antes de publicarlos. El build informa el estado Authenticode; una salida `NotSigned` es apta para validación interna, no para distribución final.
