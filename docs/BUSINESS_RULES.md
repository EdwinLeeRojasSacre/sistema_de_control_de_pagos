# Reglas de negocio

Este documento resume reglas implementadas en servicios, DTOs y restricciones de base de datos.

## Familias y personas

- La familia es independiente del período escolar: `family_groups` no contiene `school_period_id`.
- Una familia debe conservar al menos un estudiante y un adulto en sus flujos de creación/edición.
- Debe existir exactamente un apoderado cuya persona esté activa.
- El apoderado necesita fecha de nacimiento y debe tener 18 años o más.
- Solo puede existir un integrante `PADRE` y uno `MADRE` por familia.
- Una persona no se duplica dentro de la misma familia.
- Los estudiantes se vinculan como integrantes `ESTUDIANTE`; los parentescos adultos admitidos son PADRE, MADRE, PADRASTRO, MADRASTRA, ABUELO, ABUELA, TIO, TIA, HERMANO, HERMANA y OTRO.
- Editar una familia no permite retirar o reasignar estudiantes; esas operaciones corresponden a los flujos académicos explícitos.
- El nombre de la familia se regenera a partir del apoderado.

## Estudiantes y matrículas

- Cada estudiante referencia exactamente una persona.
- El estudiante y su persona deben estar activos y pertenecer a una familia activa para matricularse.
- Solo se matricula en un período activo y `OPEN`, dentro de un aula activa del mismo período.
- Un estudiante tiene como máximo una matrícula por período.
- El aula solo puede cambiarse mientras la matrícula esté activa y el período permanezca abierto; el aula destino debe ser activa y del mismo período.
- Las matrículas de períodos `CLOSED` se muestran como históricas.

## Períodos escolares

- El año es único y las fechas deben pertenecer coherentemente al año indicado.
- Un nuevo período nace `PLANNED` y habilitado.
- Estados visibles: `PLANNED` (PLANIFICADO), `OPEN` (ABIERTO) y `CLOSED` (CERRADO).
- Solo un período planificado y habilitado puede abrirse.
- Solo puede abrirse el año actual o el siguiente. Como el año es único, esto limita el estado abierto al período vigente y, opcionalmente, al siguiente.
- Al abrir, si el destino no tiene aulas, se copian las aulas activas del año anterior con nuevos IDs dentro de la misma transacción.
- Si el destino ya tiene aulas, la herencia no duplica estructura.
- Un período vigente solo puede cerrarse en diciembre.
- Un período anterior que todavía esté abierto puede cerrarse de manera atrasada.
- Un período futuro no puede cerrarse.
- `CLOSED` es histórico: no puede editarse ni volver a abrirse.
- Habilitar y deshabilitar solo aplica a períodos `PLANNED`.

## Estructura académica

- Un aula pertenece a un período, nivel y turno.
- La combinación período/nivel/turno/nombre es única.
- Las operaciones administrativas respetan el estado y vigencia del período y del aula.

## Pagos

- Una operación de pago pertenece a una familia y un período, y registra al usuario responsable.
- APAFA se controla por familia y período: como máximo un `payment_family_item`.
- Taller se controla por estudiante y período: como máximo un `payment_student_item`.
- Taller solo puede registrarse para estudiantes pertenecientes a la familia y matriculados en el período del pago.
- La consulta representa existencia del item como `PAGADO`; su ausencia se reporta como `NO_PAGADO`/DEBE.
- Una operación debe incluir APAFA, al menos un Taller, o ambos.
- Las restricciones únicas y transacciones serializables protegen frente a pagos duplicados concurrentes.

## Vouchers

- Todo pago requiere al menos un voucher.
- Se aceptan PDF, JPEG, PNG y WebP; el controlador admite hasta 10 archivos de 10 MiB cada uno.
- Cada voucher debe sustentar al menos un concepto.
- APAFA y cada Taller seleccionado deben quedar asociados exactamente a un voucher.
- Un vínculo no puede apuntar a un concepto de otro pago.
- Los metadatos y hash se guardan en PostgreSQL; el archivo se guarda en storage.
- Si falla la transacción de pago, los archivos recién almacenados se eliminan.
- Al eliminar o corregir un voucher, los items sin respaldo restante pueden revertirse según las asociaciones persistidas.

## Usuarios, seguridad y auditoría

- Username y persona asociada son únicos; una cuenta no puede reasignarse a otra persona ni cambiar de rol durante la edición.
- Solo puede existir una cuenta activa por cada rol gestionado (`SECRETARIA` o `DIRECCION`).
- Administrador gestiona Secretaría y Dirección; Secretaría solo Dirección; Dirección no administra usuarios.
- Las contraseñas se almacenan con bcrypt. Una contraseña temporal exige cambio antes de operar.
- Usuario, persona y rol deben estar activos en cada request autenticado.
- Cambios relevantes de usuarios, familias, matrículas, períodos, estructura, pagos y vouchers crean entradas de auditoría con actor y contexto, sin guardar contraseñas en los snapshots.

