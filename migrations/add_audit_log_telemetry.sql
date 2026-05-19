ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS method        VARCHAR(10),
  ADD COLUMN IF NOT EXISTS path          VARCHAR(255),
  ADD COLUMN IF NOT EXISTS status_code   INT,
  ADD COLUMN IF NOT EXISTS duration_ms   INT,
  ADD COLUMN IF NOT EXISTS tipo_persona  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS body_snapshot TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_log_fecha  ON audit_log (fecha);
CREATE INDEX IF NOT EXISTS idx_audit_log_path   ON audit_log (path);
CREATE INDEX IF NOT EXISTS idx_audit_log_accion ON audit_log (accion);
