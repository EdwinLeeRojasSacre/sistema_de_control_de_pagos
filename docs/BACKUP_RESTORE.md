# Backup y restauración

Los respaldos deben conservar juntos PostgreSQL y los vouchers para mantener coherencia documental.

## Backup

```powershell
.\scripts\production\backup.ps1 `
  -DatabaseName "sistema_control_pagos" `
  -DatabaseUser "usuario_backup"
```

El destino predeterminado es `C:\ProgramData\SistemaControlPagos\backups\<timestamp>`. Cada backup contiene:

- `database.dump` en formato custom de PostgreSQL;
- directorio `vouchers`;
- `manifest.json` con formato, fecha, conteo y checksum.

La contraseña no se pasa como argumento ni se guarda en el manifest. Use `.pgpass`/`pgpass.conf` con ACL restrictivas o `PGPASSWORD` sólo durante el proceso controlado. No existe eliminación automática ni retención agresiva.

## Validación segura

```powershell
.\scripts\production\restore.ps1 `
  -BackupPath "C:\ruta\backup" `
  -DatabaseName "sistema_control_pagos" `
  -DatabaseUser "usuario_restore" `
  -ValidateOnly
```

Esto valida estructura, manifest y checksum; no detiene procesos ni restaura datos.

## Restore real

Una restauración exige `-ConfirmRestore`. Por defecto crea primero un backup preventivo, detiene sólo los PIDs controlados, ejecuta `pg_restore`, conserva el storage anterior con sufijo `pre-restore`, copia vouchers, inicia la aplicación y ejecuta health checks.

```powershell
.\scripts\production\restore.ps1 `
  -BackupPath "C:\ruta\backup" `
  -DatabaseName "sistema_control_pagos" `
  -DatabaseUser "usuario_restore" `
  -ConfirmRestore
```

No use `-SkipSafetyBackup` salvo que exista un respaldo externo validado. Pruebe restauraciones periódicamente en un ambiente aislado.

## Instalación Windows

El instalador registra `SistemaControlPagosBackup` diariamente a las 02:00 por defecto; el horario puede definirse con `/BACKUP_TIME=HH:mm`. La tarea corre como SYSTEM, lee la configuración protegida y no expone la contraseña en su línea de comandos.

El acceso **Crear respaldo del Sistema de Control de Pagos** ejecuta el mismo flujo con elevación y muestra solo éxito o fallo. La desinstalación elimina la tarea, pero conserva los backups.
