# Requisitos del sistema

## Objetivo

Proveer a la I.E.I. Cuna Jardín N.° 85 “María Inmaculada Concepción” una aplicación centralizada para controlar familias, matrículas, pagos institucionales, evidencia documental y reportes por período escolar.

## Alcance

Incluye autenticación, perfiles, usuarios operativos, períodos, estructura académica, familias, estudiantes, matrículas, pagos de APAFA/Taller, vouchers, reportes, exportaciones y auditoría. No incluye pasarela bancaria, facturación electrónica, mensajería, aplicación móvil ni infraestructura cloud definida.

## Actores

- **ADMINISTRADOR:** configuración y operación general; administra usuarios Secretaría/Dirección.
- **SECRETARIA:** operación familiar, académica y financiera; administra Dirección.
- **DIRECCION:** consulta y exportación de reportes.

## Requisitos funcionales

| ID | Requisito |
| --- | --- |
| RF-01 | Autenticar por username o correo único y emitir JWT. |
| RF-02 | Exigir cambio de contraseña temporal y permitir cambio autenticado. |
| RF-03 | Mantener perfiles y administrar cuentas según RBAC. |
| RF-04 | Crear y gestionar períodos y su ciclo `PLANNED` → `OPEN` → `CLOSED`. |
| RF-05 | Gestionar aulas por período, nivel y turno, incluida herencia al abrir. |
| RF-06 | Registrar, consultar, editar e importar familias con un apoderado válido. |
| RF-07 | Registrar estudiantes y matrículas, consultar historial y cambiar aula cuando esté permitido. |
| RF-08 | Registrar APAFA por familia y Taller por estudiante evitando duplicados por período. |
| RF-09 | Cargar vouchers y mantener asociaciones exactas con conceptos del pago. |
| RF-10 | Consultar estados PAGO/DEBE, resúmenes y reportes filtrables. |
| RF-11 | Exportar reportes en XLSX y PDF. |
| RF-12 | Auditar operaciones sensibles con actor, fecha, IP/dispositivo y snapshots seguros. |
| RF-13 | Cerrar sesión y expirar la sesión frontend tras 30 minutos de inactividad. |

## Requisitos no funcionales

- TypeScript estricto en backend y frontend.
- Validación de DTOs con rechazo de propiedades no declaradas.
- Integridad relacional y unicidad en PostgreSQL.
- Operaciones compuestas críticas dentro de transacciones; reintento ante conflictos serializables donde está implementado.
- Diseño web responsive mediante Next.js y Tailwind CSS.
- Evidencia documental con hash, metadatos, MIME permitido y ruta validada contra traversal.
- Tests unitarios, HTTP E2E y regresiones específicas de base de datos.

## Seguridad

- JWT Bearer firmado con secreto obligatorio y expiración de 8 horas.
- bcrypt para hashes de contraseña.
- Revalidación de estado de usuario, persona y rol en requests protegidos.
- RBAC en backend; las restricciones visuales no sustituyen la autorización.
- `401` invalida sesión; `403` conserva autenticación y aplica navegación segura.
- Vouchers servidos con `nosniff` y `Cache-Control: private, no-store`.
- Secretos solo por variables de entorno y nunca versionados.

## Persistencia y auditoría

- PostgreSQL es la fuente transaccional.
- El contenido de vouchers reside en filesystem persistente; la base conserva su referencia y asociaciones.
- Base y storage requieren respaldos coordinados.
- No existe borrado lógico uniforme; los campos `is_active` expresan vigencia solo en entidades que los declaran.

## Restricciones

- CORS está configurado actualmente para `http://localhost:3000`.
- No hay proveedor cloud ni mecanismo de despliegue elegido.
- No existe migración automatizada para provisionar la primera cuenta operativa.
- Los E2E de base de datos exigen una base llamada `sgpe_dev` y realizan cambios temporales con limpieza posterior.
- El storage local debe ser persistente y escribible por el backend.

