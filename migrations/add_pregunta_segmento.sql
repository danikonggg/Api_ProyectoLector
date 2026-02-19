-- ============================================
-- MIGRACIÓN: PreguntaSegmento
-- ============================================
-- Preguntas por nivel (basico, intermedio, avanzado) generadas por IA
-- para cada segmento al cargar el libro.
-- Ejecutar: psql -U postgres -d ProyectoLector -f migrations/add_pregunta_segmento.sql
-- ============================================

CREATE TABLE IF NOT EXISTS "PreguntaSegmento" (
	"id" bigint NOT NULL,
	"segmento_id" bigint NOT NULL,
	"nivel" varchar(20) NOT NULL,
	"texto_pregunta" text NOT NULL,
	"orden" int NOT NULL DEFAULT 1,
	PRIMARY KEY ("id")
);

CREATE SEQUENCE IF NOT EXISTS "PreguntaSegmento_id_seq";
ALTER TABLE "PreguntaSegmento" ALTER COLUMN "id" SET DEFAULT nextval('"PreguntaSegmento_id_seq"');
ALTER SEQUENCE "PreguntaSegmento_id_seq" OWNED BY "PreguntaSegmento"."id";

ALTER TABLE "PreguntaSegmento" DROP CONSTRAINT IF EXISTS "PreguntaSegmento_fk1";
ALTER TABLE "PreguntaSegmento" ADD CONSTRAINT "PreguntaSegmento_fk1" FOREIGN KEY ("segmento_id") REFERENCES "Segmento"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_pregunta_segmento_segmento_id" ON "PreguntaSegmento"("segmento_id");
CREATE INDEX IF NOT EXISTS "idx_pregunta_segmento_nivel" ON "PreguntaSegmento"("segmento_id", "nivel");
