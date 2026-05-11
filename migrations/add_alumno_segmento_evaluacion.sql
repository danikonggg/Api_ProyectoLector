CREATE TABLE IF NOT EXISTS "Alumno_Segmento_Evaluacion" (
  "id" BIGSERIAL PRIMARY KEY,
  "alumno_id" BIGINT NOT NULL REFERENCES "Alumno"("id") ON DELETE CASCADE,
  "libro_id" BIGINT NOT NULL REFERENCES "Libro"("id") ON DELETE CASCADE,
  "segmento_id" BIGINT NOT NULL REFERENCES "Segmento"("id") ON DELETE CASCADE,
  "nivel_pregunta" VARCHAR(20) NOT NULL,
  "intento" INT NOT NULL DEFAULT 1,
  "preguntas" JSONB NOT NULL,
  "respuestas" JSONB NOT NULL,
  "score" INT NOT NULL DEFAULT 0,
  "aprobado" BOOLEAN NOT NULL DEFAULT FALSE,
  "puede_avanzar" BOOLEAN NOT NULL DEFAULT FALSE,
  "apoyos" JSONB NULL,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_alumno_segmento_eval_alumno_libro_segmento"
  ON "Alumno_Segmento_Evaluacion" ("alumno_id", "libro_id", "segmento_id");

CREATE INDEX IF NOT EXISTS "idx_alumno_segmento_eval_segmento"
  ON "Alumno_Segmento_Evaluacion" ("segmento_id");
