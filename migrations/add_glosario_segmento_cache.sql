-- ============================================
-- MIGRACIÓN: Glosario global + cache por segmento
-- ============================================
-- Ejecutar: psql -U postgres -d ProyectoLector -f migrations/add_glosario_segmento_cache.sql
-- ============================================

CREATE TABLE IF NOT EXISTS glosario (
  id bigserial PRIMARY KEY,
  palabra varchar(180) NOT NULL UNIQUE,
  definicion text,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seccion_glosario (
  id bigserial PRIMARY KEY,
  segmento_id bigint NOT NULL,
  palabra varchar(180) NOT NULL,
  definicion text,
  CONSTRAINT fk_seccion_glosario_segmento
    FOREIGN KEY (segmento_id) REFERENCES "Segmento"("id") ON DELETE CASCADE,
  CONSTRAINT uq_seccion_glosario_segmento_palabra UNIQUE (segmento_id, palabra)
);

CREATE INDEX IF NOT EXISTS idx_seccion_glosario_segmento_id
  ON seccion_glosario(segmento_id);
