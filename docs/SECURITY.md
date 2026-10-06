# Seguridad de la instalación local

- Los servicios usan `LocalService`, no Administrador.
- `Program Files` conserva solo lectura/ejecución para usuarios normales.
- `ProgramData` concede lectura de configuración y modificación únicamente en logs/storage al servicio; Administradores y SYSTEM conservan control.
- `backend.env` no se versiona ni se incluye preconfigurado; queda limitado a Administradores, SYSTEM y lectura para LocalService.
- El JWT secret se genera con un RNG criptográfico de 48 bytes y nunca se imprime.
- Passwords y `DATABASE_URL` no aparecen en XML WinSW, argumentos de servicios, manifests ni logs del launcher.
- Los puertos se inspeccionan sin terminar procesos ajenos.

Node.js y WinSW proceden de fuentes oficiales con versiones/SHA-256 fijados en `installer/vendor-manifest.json`. Consulte `THIRD_PARTY_NOTICES.md`.

El Setup y launcher internos no están firmados. Firma Authenticode institucional y prueba en VM limpia son bloqueantes antes de distribución.
