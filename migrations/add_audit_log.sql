-- ============================================
-- TABLA: audit_log
-- ============================================
-- Registro de acciones sensibles para auditoría.
-- Solo visible por administradores.
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  accion VARCHAR(80) NOT NULL,
  usuario_id BIGINT,
  ip VARCHAR(45),
  detalles TEXT,
  fecha TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_fecha ON audit_log (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_accion ON audit_log (accion);
CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON audit_log (usuario_id);
