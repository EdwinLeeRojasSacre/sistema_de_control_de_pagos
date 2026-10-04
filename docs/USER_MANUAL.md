# Manual de usuario

## Acceso y sesión

1. Abra `/login`.
2. Ingrese usuario o correo y contraseña.
3. Si la cuenta tiene contraseña temporal, el sistema solicitará cambiarla antes de continuar.
4. La sesión se cierra automáticamente después de 30 minutos sin actividad. Un `401` también limpia la sesión y vuelve al login.

Todas las personas autenticadas pueden usar **Contraseña** y **Acerca del sistema**. **Mi perfil** se muestra actualmente al Administrador y permite actualizar sus datos personales, no su rol ni su identidad de cuenta.

## Responsabilidades por rol

| Módulo | Administrador | Secretaría | Dirección |
| --- | :---: | :---: | :---: |
| Dashboard | Sí | Sí | No |
| Registro Familiar | Sí | Sí | No |
| Matrículas | Sí | Sí | No |
| Pagos y vouchers | Sí | Sí | No |
| Reportes/exportación | Sí | Sí | Sí |
| Períodos y aulas | Sí | Sí | No |
| Administración de usuarios | Secretaría y Dirección | Solo Dirección | No |

Dirección es redirigida a `/dashboard/reports` cuando intenta abrir una ruta no permitida.

## ADMINISTRADOR

### Usuarios

En **Administración → Usuarios** puede:

- buscar una persona existente por documento o registrar una nueva;
- crear cuentas Secretaría o Dirección;
- editar username y datos personales sin cambiar persona ni rol;
- activar/desactivar cuentas;
- restablecer una contraseña temporal.

Antes de activar otra cuenta del mismo rol, desactive la anterior. Entregue las contraseñas temporales por un canal seguro.

### Perfil

Use **Mi perfil** para revisar y actualizar datos propios. El cambio de contraseña se realiza desde **Contraseña**.

## ADMINISTRADOR y SECRETARIA

### Períodos escolares

En **Administración → Períodos Escolares**:

1. cree el año y sus fechas; nace PLANIFICADO;
2. habilite/deshabilite solo mientras esté planificado;
3. abra el período cuando corresponda al año actual o siguiente;
4. al abrir, el sistema hereda aulas activas del año anterior si el destino está vacío;
5. cierre el período vigente únicamente en diciembre; uno atrasado puede cerrarse después;
6. un período futuro no puede cerrarse y uno CERRADO queda histórico.

### Estructura académica

Seleccione el período en **Administración → Estructura Académica**. Consulte ciclos, niveles y aulas; cree, edite, habilite o deshabilite aulas según las reglas del período. Verifique nivel, turno, nombre y capacidad antes de guardar.

### Familias

En **Registro Familiar** puede buscar, consultar, crear y editar grupos familiares. El flujo permite reutilizar personas existentes por documento e incorporar estudiantes y adultos.

- Marque exactamente un adulto activo como apoderado.
- Registre su fecha de nacimiento; debe ser mayor de edad.
- No duplique PADRE o MADRE.
- La edición familiar conserva estudiantes; use los flujos específicos para incorporaciones académicas.

La importación permite descargar plantilla, previsualizar errores y confirmar archivos válidos.

### Matrículas

Use **Matrículas** para consultar por período y estudiante. Al cambiar el período, la tabla se actualiza desde backend. **Nueva matrícula** requiere estudiante activo, familia activa, período abierto y aula activa del mismo período.

En el detalle puede cambiar el aula únicamente mientras el período esté abierto. También existe importación con plantilla, previsualización y confirmación.

### Pagos

En **Pagos** puede filtrar por período o por cualquier integrante activo de la familia. La columna Apoderado identifica al responsable familiar.

Para registrar:

1. seleccione período y familia;
2. marque APAFA y/o Taller de estudiantes matriculados;
3. indique fecha y datos opcionales de operación;
4. adjunte al menos un voucher;
5. asocie cada concepto seleccionado exactamente a un voucher;
6. confirme el registro.

El sistema evita duplicar APAFA por familia/período y Taller por estudiante/período.

### Vouchers

Desde el listado de pagos puede visualizar o descargar comprobantes compatibles, consultar asociaciones, corregir vínculos y eliminar un voucher. Una corrección o eliminación puede revertir un concepto si queda sin evidencia asociada; revise la confirmación antes de continuar.

### Reportes

En **Reportes**:

- **Resumen** muestra métricas y cumplimiento por filtros académicos.
- **Exportar** lista PAGO/DEBE, admite búsqueda y genera XLSX o PDF.

Seleccione período, ciclo, nivel, turno, aula y tipo de pago según la consulta requerida.

## DIRECCION

Dirección accede a **Reportes** para consultar resúmenes y exportar información en XLSX/PDF. No puede administrar familias, matrículas, pagos, usuarios ni configuración académica.

## Cierre de sesión

Pulse **Cerrar sesión** en el panel lateral. La información de sesión se elimina y el navegador vuelve a `/login`; volver atrás no restaura una pantalla protegida funcional.
