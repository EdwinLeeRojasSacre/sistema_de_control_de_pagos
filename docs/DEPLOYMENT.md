# Despliegue productivo local en Windows

La distribución 1.0.0 se genera como `SistemaControlPagos-Setup-1.0.0.exe` para Windows 10/11 x64. El usuario final no necesita Node.js, npm, VS Code ni PowerShell: Node.js 24.20.0 LTS va incluido.

## Layout instalado

```text
C:\Program Files\Sistema de Control de Pagos\
  backend\
  frontend\
  runtime\node\node.exe
  services\
  scripts\
  SistemaControlPagos.exe

C:\ProgramData\SistemaControlPagos\
  config\backend.env
  storage\vouchers\
  logs\backend\
  logs\frontend\
  backups\
```

Los servicios `SistemaControlPagosBackend` y `SistemaControlPagosFrontend` arrancan automáticamente como `LocalService`. WinSW rota logs, reinicia ante fallos y declara la dependencia del frontend respecto del backend. El launcher espera `/health` y la portada antes de abrir `http://127.0.0.1:3000/login`.

## PostgreSQL

Fase 2 usa una instalación PostgreSQL existente. El asistente solicita ruta `bin`, host, puerto, base, usuario y password; crea `sistema_control_pagos` si no existe y aplica `prisma migrate deploy` sobre el esquema `sgpe`. No se incluye ni instala PostgreSQL silenciosamente.

Los puertos 3000/3001 se validan sin terminar procesos. Si pertenecen a otra aplicación, la instalación se detiene. `NEXT_PUBLIC_API_URL` queda integrado al bundle como `http://localhost:3001`.

## Build

`installer/build/Build-Installer.ps1` verifica checksums de Node/WinSW, construye el staging, compila el launcher y ejecuta Inno Setup 7.1.0. Los artefactos, runtimes descargados, secretos y Setup se ignoran en Git.

Consulte [INSTALLER.md](INSTALLER.md), [OPERATIONS.md](OPERATIONS.md), [UPGRADE.md](UPGRADE.md) y [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
