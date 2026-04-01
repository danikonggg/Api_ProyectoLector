-- Tabla para códigos de vinculación padre–alumno de un solo uso
CREATE TABLE IF NOT EXISTS "Alumno_Vinculacion_Padre" (
  "id" BIGSERIAL PRIMARY KEY,
  "alumno_id" BIGINT NOT NULL,
  "codigo" VARCHAR(64) NOT NULL UNIQUE,
  "usado" BOOLEAN NOT NULL DEFAULT FALSE,
  "usado_en" TIMESTAMP NULL,
  "expira_en" TIMESTAMP NULL,
  "creado_en" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "FK_Alumno_Vinculacion_Padre_Alumno"
    FOREIGN KEY ("alumno_id") REFERENCES "Alumno" ("id")
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "IDX_Alumno_Vinculacion_Padre_codigo"
  ON "Alumno_Vinculacion_Padre" ("codigo");

