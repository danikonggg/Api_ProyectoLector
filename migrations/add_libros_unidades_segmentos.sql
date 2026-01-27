-- ============================================
-- MIGRACIÓN: Libros, Unidades, Segmentos
-- ============================================
-- Extiende Libro (estado, num_paginas), crea Unidad y Segmento.
-- ============================================

-- Campos adicionales en Libro
ALTER TABLE "Libro" ADD COLUMN IF NOT EXISTS "estado" varchar(50) DEFAULT 'procesando';
ALTER TABLE "Libro" ADD COLUMN IF NOT EXISTS "num_paginas" bigint;

-- Unidad (agrupación pedagógica de segmentos)
CREATE TABLE IF NOT EXISTS "Unidad" (
	"id" bigint NOT NULL,
	"libro_id" bigint NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"orden" bigint NOT NULL DEFAULT 1,
	PRIMARY KEY ("id")
);

-- Segmento (texto dividido ~100-200 palabras por idea)
CREATE TABLE IF NOT EXISTS "Segmento" (
	"id" bigint NOT NULL,
	"libro_id" bigint NOT NULL,
	"unidad_id" bigint NOT NULL,
	"contenido" text NOT NULL,
	"numero_pagina" bigint,
	"orden" bigint NOT NULL DEFAULT 1,
	"id_externo" varchar(100) NOT NULL,
	PRIMARY KEY ("id")
);

-- Secuencias
CREATE SEQUENCE IF NOT EXISTS "Unidad_id_seq";
ALTER TABLE "Unidad" ALTER COLUMN "id" SET DEFAULT nextval('"Unidad_id_seq"');
ALTER SEQUENCE "Unidad_id_seq" OWNED BY "Unidad"."id";

CREATE SEQUENCE IF NOT EXISTS "Segmento_id_seq";
ALTER TABLE "Segmento" ALTER COLUMN "id" SET DEFAULT nextval('"Segmento_id_seq"');
ALTER SEQUENCE "Segmento_id_seq" OWNED BY "Segmento"."id";

-- FKs
ALTER TABLE "Unidad" DROP CONSTRAINT IF EXISTS "Unidad_fk1";
ALTER TABLE "Unidad" ADD CONSTRAINT "Unidad_fk1" FOREIGN KEY ("libro_id") REFERENCES "Libro"("id") ON DELETE CASCADE;

ALTER TABLE "Segmento" DROP CONSTRAINT IF EXISTS "Segmento_fk1";
ALTER TABLE "Segmento" ADD CONSTRAINT "Segmento_fk1" FOREIGN KEY ("libro_id") REFERENCES "Libro"("id") ON DELETE CASCADE;
ALTER TABLE "Segmento" DROP CONSTRAINT IF EXISTS "Segmento_fk2";
ALTER TABLE "Segmento" ADD CONSTRAINT "Segmento_fk2" FOREIGN KEY ("unidad_id") REFERENCES "Unidad"("id") ON DELETE CASCADE;

-- Índices
CREATE INDEX IF NOT EXISTS "idx_unidad_libro_id" ON "Unidad"("libro_id");
CREATE INDEX IF NOT EXISTS "idx_segmento_libro_id" ON "Segmento"("libro_id");
CREATE INDEX IF NOT EXISTS "idx_segmento_unidad_id" ON "Segmento"("unidad_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_segmento_id_externo" ON "Segmento"("id_externo");
