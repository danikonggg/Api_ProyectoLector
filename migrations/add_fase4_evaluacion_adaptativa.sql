-- ============================================
-- FASE 4: Evaluacion Adaptativa
-- ============================================

-- PreguntaSegmento: add MCQ columns
ALTER TABLE "PreguntaSegmento"
  ADD COLUMN IF NOT EXISTS libro_id BIGINT,
  ADD COLUMN IF NOT EXISTS opcion_a TEXT,
  ADD COLUMN IF NOT EXISTS opcion_b TEXT,
  ADD COLUMN IF NOT EXISTS opcion_c TEXT,
  ADD COLUMN IF NOT EXISTS opcion_d TEXT,
  ADD COLUMN IF NOT EXISTS respuesta_correcta VARCHAR(1),
  ADD COLUMN IF NOT EXISTS tipo VARCHAR(30);

-- Segmento: add hint and summary
ALTER TABLE "Segmento"
  ADD COLUMN IF NOT EXISTS pista_contextual TEXT,
  ADD COLUMN IF NOT EXISTS resumen TEXT;

-- AlumnoSegmentoEvaluacion: add time and error tracking
ALTER TABLE "Alumno_Segmento_Evaluacion"
  ADD COLUMN IF NOT EXISTS tiempo_respuesta_ms INT,
  ADD COLUMN IF NOT EXISTS tipos_error JSONB;

-- New tables
CREATE TABLE IF NOT EXISTS alumno_perfil_aprendizaje (
  id BIGSERIAL PRIMARY KEY,
  alumno_id BIGINT NOT NULL,
  libro_id BIGINT NOT NULL,
  nivel_actual VARCHAR(20) NOT NULL DEFAULT 'basico',
  tiempo_minimo_actual INT NOT NULL DEFAULT 300,
  racha_positiva INT NOT NULL DEFAULT 0,
  racha_negativa INT NOT NULL DEFAULT 0,
  diagnostico_completado BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(alumno_id, libro_id)
);

CREATE TABLE IF NOT EXISTS pregunta_diagnostico (
  id BIGSERIAL PRIMARY KEY,
  texto_pregunta TEXT NOT NULL,
  opcion_a TEXT NOT NULL,
  opcion_b TEXT NOT NULL,
  opcion_c TEXT NOT NULL,
  opcion_d TEXT NOT NULL,
  respuesta_correcta VARCHAR(1) NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT true
);
