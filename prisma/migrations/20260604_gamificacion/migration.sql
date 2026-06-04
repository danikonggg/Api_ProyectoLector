-- Migration: gamificacion (Fase 5)
-- Generated: 2026-06-04

-- ============================================
-- 1. Catálogo de insignias
-- ============================================
CREATE TABLE IF NOT EXISTS "Insignia" (
  "id"          BIGSERIAL PRIMARY KEY,
  "clave"       VARCHAR(60)  NOT NULL UNIQUE,
  "nombre"      VARCHAR(100) NOT NULL,
  "descripcion" VARCHAR(255) NOT NULL,
  "icono"       VARCHAR(100) NOT NULL,
  "categoria"   VARCHAR(40)  NOT NULL,
  "activa"      BOOLEAN      NOT NULL DEFAULT true,
  "creado_en"   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. Insignias obtenidas por alumno
-- ============================================
CREATE TABLE IF NOT EXISTS "Alumno_Insignia" (
  "id"           BIGSERIAL PRIMARY KEY,
  "alumno_id"    BIGINT      NOT NULL REFERENCES "Alumno"("id") ON DELETE CASCADE,
  "insignia_id"  BIGINT      NOT NULL REFERENCES "Insignia"("id"),
  "obtenida_en"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "visto"        BOOLEAN     NOT NULL DEFAULT false,
  CONSTRAINT "Alumno_Insignia_alumno_id_insignia_id_key" UNIQUE ("alumno_id", "insignia_id")
);
CREATE INDEX IF NOT EXISTS "Alumno_Insignia_alumno_id_idx" ON "Alumno_Insignia"("alumno_id");

-- ============================================
-- 3. Niveles del lector (catálogo)
-- ============================================
CREATE TABLE IF NOT EXISTS "Nivel_Lector" (
  "id"          BIGSERIAL PRIMARY KEY,
  "nivel"       INT         NOT NULL UNIQUE,
  "nombre"      VARCHAR(60) NOT NULL,
  "puntos_min"  INT         NOT NULL,
  "puntos_max"  INT         NOT NULL,
  "icono"       VARCHAR(100) NOT NULL,
  "color"       VARCHAR(20)  NOT NULL
);

-- Niveles predefinidos
INSERT INTO "Nivel_Lector" ("nivel","nombre","puntos_min","puntos_max","icono","color") VALUES
  (1, 'Lector Inicial',     0,    199,  'book-open',     '#94a3b8'),
  (2, 'Lector Curioso',     200,  499,  'book',          '#60a5fa'),
  (3, 'Lector Activo',      500,  999,  'bookmark',      '#34d399'),
  (4, 'Lector Avanzado',    1000, 1999, 'star',          '#fbbf24'),
  (5, 'Lector Experto',     2000, 3499, 'award',         '#f97316'),
  (6, 'Lector Maestro',     3500, 99999,'trophy',        '#a855f7')
ON CONFLICT ("nivel") DO NOTHING;

-- ============================================
-- 4. Progreso global del alumno
-- ============================================
CREATE TABLE IF NOT EXISTS "Alumno_Progreso" (
  "id"                  BIGSERIAL PRIMARY KEY,
  "alumno_id"           BIGINT       NOT NULL UNIQUE REFERENCES "Alumno"("id") ON DELETE CASCADE,
  "puntos_totales"      INT          NOT NULL DEFAULT 0,
  "nivel_actual"        INT          NOT NULL DEFAULT 1,
  "libros_completados"  INT          NOT NULL DEFAULT 0,
  "segmentos_leidos"    INT          NOT NULL DEFAULT 0,
  "evaluaciones_ok"     INT          NOT NULL DEFAULT 0,
  "racha_actual"        INT          NOT NULL DEFAULT 0,
  "racha_mas_larga"     INT          NOT NULL DEFAULT 0,
  "ultima_actividad"    TIMESTAMPTZ,
  "creado_en"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "actualizado_en"      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================
-- 5. Mapa personal de lectura
-- ============================================
CREATE TABLE IF NOT EXISTS "Mapa_Lectura" (
  "id"              BIGSERIAL PRIMARY KEY,
  "alumno_id"       BIGINT      NOT NULL REFERENCES "Alumno"("id") ON DELETE CASCADE,
  "libro_id"        BIGINT      NOT NULL REFERENCES "Libro"("id") ON DELETE CASCADE,
  "segmentos_ids"   JSONB       NOT NULL DEFAULT '[]',
  "completados"     JSONB       NOT NULL DEFAULT '[]',
  "porcentaje"      INT         NOT NULL DEFAULT 0,
  "creado_en"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "actualizado_en"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Mapa_Lectura_alumno_id_libro_id_key" UNIQUE ("alumno_id", "libro_id")
);
CREATE INDEX IF NOT EXISTS "Mapa_Lectura_alumno_id_idx" ON "Mapa_Lectura"("alumno_id");

-- ============================================
-- 6. Insignias del catálogo inicial
-- ============================================
INSERT INTO "Insignia" ("clave","nombre","descripcion","icono","categoria") VALUES
  ('primer_libro',        'Primera Lectura',       'Completaste tu primer libro',                    'book-open',   'lectura'),
  ('racha_3',             'En Racha',              'Evaluaciones correctas 3 días seguidos',         'flame',       'constancia'),
  ('racha_7',             'Semana Imparable',      'Evaluaciones correctas 7 días seguidos',         'fire',        'constancia'),
  ('evaluador_perfecto',  'Sin Errores',           'Respondiste un fragmento sin errores',           'check-circle','evaluacion'),
  ('explorador',          'Explorador',            'Leíste fragmentos de 3 libros distintos',        'compass',     'lectura'),
  ('anotador',            'Anotador',              'Creaste 10 anotaciones',                         'pen',         'interaccion'),
  ('subrayador',          'Subrayador',            'Subrayaste en 5 fragmentos distintos',           'highlighter', 'interaccion'),
  ('nivel_2',             'Lector Curioso',        'Alcanzaste el nivel 2',                          'book',        'nivel'),
  ('nivel_3',             'Lector Activo',         'Alcanzaste el nivel 3',                          'bookmark',    'nivel'),
  ('nivel_4',             'Lector Avanzado',       'Alcanzaste el nivel 4',                          'star',        'nivel'),
  ('nivel_5',             'Lector Experto',        'Alcanzaste el nivel 5',                          'award',       'nivel'),
  ('nivel_6',             'Lector Maestro',        'Alcanzaste el nivel máximo',                     'trophy',      'nivel'),
  ('velocista',           'Velocista',             'Completaste un fragmento en tiempo récord',      'zap',         'lectura'),
  ('constante',           'Constante',             'Iniciaste sesión 5 días consecutivos',           'calendar',    'constancia'),
  ('completista',         'Completista',           'Completaste todos los fragmentos de un libro',   'check-square','lectura')
ON CONFLICT ("clave") DO NOTHING;
