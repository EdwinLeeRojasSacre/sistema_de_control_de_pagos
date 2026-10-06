INSERT INTO "sgpe"."roles" ("code", "name", "description", "is_active", "created_at", "updated_at")
VALUES
  ('ADMINISTRADOR', 'Administrador', 'Control total del sistema', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('SECRETARIA', 'Secretaría', 'Registro de pagos y gestión operativa', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('DIRECCION', 'Dirección', 'Consulta y reportes', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
