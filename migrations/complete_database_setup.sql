-- ============================================
-- SCRIPT COMPLETO DE CONFIGURACIÓN DE BASE DE DATOS
-- ============================================
-- Incluye TODAS las migraciones en un solo archivo.
-- Ejecutar una sola vez en una base de datos vacía:
--   psql -U postgres -d api_lector -f migrations/complete_database_setup.sql
--
-- Contenido: tablas base, auth, Director, Libro/Unidad/Segmento,
-- Escuela_Libro_Pendiente, audit_log, seed Materia Lectura.
-- ============================================

-- ============================================
-- PARTE 1: CREAR TABLAS
-- ============================================

CREATE TABLE IF NOT EXISTS "Persona" (
	"nombre" varchar(100) NOT NULL,
	"apellido" varchar(100) NOT NULL,
	"correo" varchar(150),
	"telefono" varchar(20),
	"fecha_nacimiento" date,
	"genero" varchar(30),
	"id" bigint NOT NULL,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Escuela" (
	"id" bigint NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"nivel" varchar(50) NOT NULL,
	"clave" varchar(50),
	"direccion" varchar(200),
	"telefono" varchar(20),
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Admin" (
	"id" bigint NOT NULL,
	"persona_id" bigint NOT NULL,
	"fecha_alta" date,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Padre" (
	"id" bigint NOT NULL,
	"persona_id" bigint NOT NULL,
	"parentesco" varchar(50),
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Director" (
	"id" bigint NOT NULL,
	"persona_id" bigint NOT NULL,
	"escuela_id" bigint NOT NULL,
	"fecha_nombramiento" date,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Maestro" (
	"especialidad" varchar(100),
	"fecha_contratacion" date,
	"id" bigint NOT NULL,
	"persona_id" bigint NOT NULL,
	"escuela_id" bigint NOT NULL,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Materia" (
	"id" bigint NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"descripcion" varchar(255),
	"nivel" varchar(50),
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Alumno" (
	"ciclo_escolar" varchar(20),
	"id" bigint NOT NULL,
	"persona_id" bigint NOT NULL,
	"escuela_id" bigint NOT NULL,
	"padre_id" bigint,
	"grado" bigint NOT NULL,
	"grupo" varchar(10),
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Alumno_Maestro" (
	"fecha_fin" date,
	"id" bigint NOT NULL,
	"alumno_id" bigint NOT NULL,
	"maestro_id" bigint NOT NULL,
	"materia_id" bigint NOT NULL,
	"fecha_inicio" date NOT NULL,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Libro" (
	"titulo" varchar(150) NOT NULL,
	"materia_id" bigint NOT NULL,
	"id" bigint NOT NULL,
	"codigo" varchar(50) NOT NULL,
	"grado" bigint NOT NULL,
	"descripcion" varchar(255),
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Escuela_Libro" (
	"activo" boolean,
	"id" bigint NOT NULL,
	"escuela_id" bigint NOT NULL,
	"libro_id" bigint NOT NULL,
	"fecha_inicio" date NOT NULL,
	"fecha_fin" date,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Juego" (
	"materia_id" bigint NOT NULL,
	"libro_id" bigint NOT NULL,
	"id" bigint NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"descripcion" varchar(255),
	"nivel_dificultad" varchar(50),
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Evaluacion" (
	"id" bigint NOT NULL,
	"libro_id" bigint NOT NULL,
	"materia_id" bigint NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"tipo" varchar(50) NOT NULL,
	"puntaje_maximo" bigint NOT NULL,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Pregunta" (
	"id" bigint NOT NULL,
	"evaluacion_id" bigint NOT NULL,
	"texto" varchar(255) NOT NULL,
	"tipo" varchar(100) NOT NULL,
	"puntaje" bigint,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Opcion" (
	"id" bigint NOT NULL,
	"pregunta_id" bigint NOT NULL,
	"texto" varchar(200) NOT NULL,
	"es_correcta" boolean,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Intento_Evaluacion" (
	"id" bigint NOT NULL,
	"alumno_id" bigint NOT NULL,
	"evaluacion_id" bigint NOT NULL,
	"puntaje_obtenido" bigint,
	"fecha" timestamp without time zone,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Progreso_Juego" (
	"id" bigint NOT NULL,
	"alumno_id" bigint NOT NULL,
	"juego_id" bigint NOT NULL,
	"nivel_alcanzado" bigint,
	"puntaje" bigint,
	"fecha" timestamp without time zone,
	PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Progreso_Libro" (
	"id" bigint NOT NULL,
	"alumno_id" bigint NOT NULL,
	"libro_id" bigint NOT NULL,
	"porcentaje" bigint,
	"actualizado" timestamp without time zone,
	PRIMARY KEY ("id")
);

-- ============================================
-- PARTE 2: AGREGAR CAMPOS DE AUTENTICACIÓN A PERSONA
-- ============================================

ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "password" varchar(255);
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "tipo_persona" varchar(50);
ALTER TABLE "Persona" ADD COLUMN IF NOT EXISTS "activo" boolean DEFAULT true;
CREATE INDEX IF NOT EXISTS "idx_persona_correo" ON "Persona"("correo");

-- ============================================
-- PARTE 3: CREAR SECUENCIAS PARA AUTO-INCREMENT
-- ============================================

-- Función auxiliar para crear secuencia y configurar columna
CREATE OR REPLACE FUNCTION setup_sequence(table_name text, column_name text)
RETURNS void AS $$
DECLARE
    seq_name text;
    max_id bigint;
    quoted_seq_name text;
    create_seq_sql text;
    setval_sql text;
    alter_table_sql text;
    alter_seq_sql text;
BEGIN
    -- Construir nombre de secuencia con comillas
    quoted_seq_name := '"' || table_name || '_' || column_name || '_seq"';
    seq_name := table_name || '_' || column_name || '_seq';
    
    -- Crear secuencia si no existe (usando comillas explícitas en SQL directo)
    create_seq_sql := 'CREATE SEQUENCE IF NOT EXISTS ' || quoted_seq_name;
    EXECUTE create_seq_sql;
    
    -- Obtener el valor máximo actual
    EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I', column_name, table_name) INTO max_id;
    
    -- Configurar la secuencia (construir SQL directamente con comillas)
    IF max_id > 0 THEN
        setval_sql := 'SELECT setval(''' || quoted_seq_name || ''', ' || (max_id + 1) || ', false)';
    ELSE
        setval_sql := 'SELECT setval(''' || quoted_seq_name || ''', 1, false)';
    END IF;
    EXECUTE setval_sql;
    
    -- Configurar DEFAULT (construir SQL directamente)
    alter_table_sql := 'ALTER TABLE "' || table_name || '" ALTER COLUMN "' || column_name || 
                       '" SET DEFAULT nextval(''' || quoted_seq_name || ''')';
    EXECUTE alter_table_sql;
    
    -- Asignar propiedad (construir SQL directamente)
    alter_seq_sql := 'ALTER SEQUENCE ' || quoted_seq_name || ' OWNED BY "' || 
                     table_name || '"."' || column_name || '"';
    EXECUTE alter_seq_sql;
END;
$$ LANGUAGE plpgsql;

-- Configurar secuencias para todas las tablas
SELECT setup_sequence('Persona', 'id');
SELECT setup_sequence('Escuela', 'id');
SELECT setup_sequence('Admin', 'id');
SELECT setup_sequence('Padre', 'id');
SELECT setup_sequence('Director', 'id');
SELECT setup_sequence('Maestro', 'id');
SELECT setup_sequence('Materia', 'id');
SELECT setup_sequence('Alumno', 'id');
SELECT setup_sequence('Alumno_Maestro', 'id');
SELECT setup_sequence('Libro', 'id');
SELECT setup_sequence('Escuela_Libro', 'id');
SELECT setup_sequence('Juego', 'id');
SELECT setup_sequence('Evaluacion', 'id');
SELECT setup_sequence('Pregunta', 'id');
SELECT setup_sequence('Opcion', 'id');
SELECT setup_sequence('Intento_Evaluacion', 'id');
SELECT setup_sequence('Progreso_Juego', 'id');
SELECT setup_sequence('Progreso_Libro', 'id');

-- Limpiar función auxiliar
DROP FUNCTION setup_sequence(text, text);

-- ============================================
-- PARTE 4: CREAR RELACIONES (FOREIGN KEYS)
-- ============================================

-- Relaciones de Admin
ALTER TABLE "Admin" DROP CONSTRAINT IF EXISTS "Admin_fk1";
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_fk1" FOREIGN KEY ("persona_id") REFERENCES "Persona"("id");

-- Relaciones de Padre
ALTER TABLE "Padre" DROP CONSTRAINT IF EXISTS "Padre_fk1";
ALTER TABLE "Padre" ADD CONSTRAINT "Padre_fk1" FOREIGN KEY ("persona_id") REFERENCES "Persona"("id");

-- Relaciones de Director
ALTER TABLE "Director" DROP CONSTRAINT IF EXISTS "Director_fk1";
ALTER TABLE "Director" ADD CONSTRAINT "Director_fk1" FOREIGN KEY ("persona_id") REFERENCES "Persona"("id");
ALTER TABLE "Director" DROP CONSTRAINT IF EXISTS "Director_fk2";
ALTER TABLE "Director" ADD CONSTRAINT "Director_fk2" FOREIGN KEY ("escuela_id") REFERENCES "Escuela"("id");

-- Relaciones de Maestro
ALTER TABLE "Maestro" DROP CONSTRAINT IF EXISTS "Maestro_fk3";
ALTER TABLE "Maestro" ADD CONSTRAINT "Maestro_fk3" FOREIGN KEY ("persona_id") REFERENCES "Persona"("id");
ALTER TABLE "Maestro" DROP CONSTRAINT IF EXISTS "Maestro_fk4";
ALTER TABLE "Maestro" ADD CONSTRAINT "Maestro_fk4" FOREIGN KEY ("escuela_id") REFERENCES "Escuela"("id");

-- Relaciones de Alumno
ALTER TABLE "Alumno" DROP CONSTRAINT IF EXISTS "Alumno_fk2";
ALTER TABLE "Alumno" ADD CONSTRAINT "Alumno_fk2" FOREIGN KEY ("persona_id") REFERENCES "Persona"("id");
ALTER TABLE "Alumno" DROP CONSTRAINT IF EXISTS "Alumno_fk3";
ALTER TABLE "Alumno" ADD CONSTRAINT "Alumno_fk3" FOREIGN KEY ("escuela_id") REFERENCES "Escuela"("id");
ALTER TABLE "Alumno" DROP CONSTRAINT IF EXISTS "Alumno_fk4";
ALTER TABLE "Alumno" ADD CONSTRAINT "Alumno_fk4" FOREIGN KEY ("padre_id") REFERENCES "Padre"("id");

-- Relaciones de Alumno_Maestro
ALTER TABLE "Alumno_Maestro" DROP CONSTRAINT IF EXISTS "Alumno_Maestro_fk2";
ALTER TABLE "Alumno_Maestro" ADD CONSTRAINT "Alumno_Maestro_fk2" FOREIGN KEY ("alumno_id") REFERENCES "Alumno"("id");
ALTER TABLE "Alumno_Maestro" DROP CONSTRAINT IF EXISTS "Alumno_Maestro_fk3";
ALTER TABLE "Alumno_Maestro" ADD CONSTRAINT "Alumno_Maestro_fk3" FOREIGN KEY ("maestro_id") REFERENCES "Maestro"("id");
ALTER TABLE "Alumno_Maestro" DROP CONSTRAINT IF EXISTS "Alumno_Maestro_fk4";
ALTER TABLE "Alumno_Maestro" ADD CONSTRAINT "Alumno_Maestro_fk4" FOREIGN KEY ("materia_id") REFERENCES "Materia"("id");

-- Relaciones de Libro
ALTER TABLE "Libro" DROP CONSTRAINT IF EXISTS "Libro_fk1";
ALTER TABLE "Libro" ADD CONSTRAINT "Libro_fk1" FOREIGN KEY ("materia_id") REFERENCES "Materia"("id");

-- Relaciones de Escuela_Libro
ALTER TABLE "Escuela_Libro" DROP CONSTRAINT IF EXISTS "Escuela_Libro_fk2";
ALTER TABLE "Escuela_Libro" ADD CONSTRAINT "Escuela_Libro_fk2" FOREIGN KEY ("escuela_id") REFERENCES "Escuela"("id");
ALTER TABLE "Escuela_Libro" DROP CONSTRAINT IF EXISTS "Escuela_Libro_fk3";
ALTER TABLE "Escuela_Libro" ADD CONSTRAINT "Escuela_Libro_fk3" FOREIGN KEY ("libro_id") REFERENCES "Libro"("id");

-- Relaciones de Juego
ALTER TABLE "Juego" DROP CONSTRAINT IF EXISTS "Juego_fk0";
ALTER TABLE "Juego" ADD CONSTRAINT "Juego_fk0" FOREIGN KEY ("materia_id") REFERENCES "Materia"("id");
ALTER TABLE "Juego" DROP CONSTRAINT IF EXISTS "Juego_fk1";
ALTER TABLE "Juego" ADD CONSTRAINT "Juego_fk1" FOREIGN KEY ("libro_id") REFERENCES "Libro"("id");

-- Relaciones de Evaluacion
ALTER TABLE "Evaluacion" DROP CONSTRAINT IF EXISTS "Evaluacion_fk1";
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_fk1" FOREIGN KEY ("libro_id") REFERENCES "Libro"("id");
ALTER TABLE "Evaluacion" DROP CONSTRAINT IF EXISTS "Evaluacion_fk2";
ALTER TABLE "Evaluacion" ADD CONSTRAINT "Evaluacion_fk2" FOREIGN KEY ("materia_id") REFERENCES "Materia"("id");

-- Relaciones de Pregunta
ALTER TABLE "Pregunta" DROP CONSTRAINT IF EXISTS "Pregunta_fk1";
ALTER TABLE "Pregunta" ADD CONSTRAINT "Pregunta_fk1" FOREIGN KEY ("evaluacion_id") REFERENCES "Evaluacion"("id");

-- Relaciones de Opcion
ALTER TABLE "Opcion" DROP CONSTRAINT IF EXISTS "Opcion_fk1";
ALTER TABLE "Opcion" ADD CONSTRAINT "Opcion_fk1" FOREIGN KEY ("pregunta_id") REFERENCES "Pregunta"("id");

-- Relaciones de Intento_Evaluacion
ALTER TABLE "Intento_Evaluacion" DROP CONSTRAINT IF EXISTS "Intento_Evaluacion_fk1";
ALTER TABLE "Intento_Evaluacion" ADD CONSTRAINT "Intento_Evaluacion_fk1" FOREIGN KEY ("alumno_id") REFERENCES "Alumno"("id");
ALTER TABLE "Intento_Evaluacion" DROP CONSTRAINT IF EXISTS "Intento_Evaluacion_fk2";
ALTER TABLE "Intento_Evaluacion" ADD CONSTRAINT "Intento_Evaluacion_fk2" FOREIGN KEY ("evaluacion_id") REFERENCES "Evaluacion"("id");

-- Relaciones de Progreso_Juego
ALTER TABLE "Progreso_Juego" DROP CONSTRAINT IF EXISTS "Progreso_Juego_fk1";
ALTER TABLE "Progreso_Juego" ADD CONSTRAINT "Progreso_Juego_fk1" FOREIGN KEY ("alumno_id") REFERENCES "Alumno"("id");
ALTER TABLE "Progreso_Juego" DROP CONSTRAINT IF EXISTS "Progreso_Juego_fk2";
ALTER TABLE "Progreso_Juego" ADD CONSTRAINT "Progreso_Juego_fk2" FOREIGN KEY ("juego_id") REFERENCES "Juego"("id");

-- Relaciones de Progreso_Libro
ALTER TABLE "Progreso_Libro" DROP CONSTRAINT IF EXISTS "Progreso_Libro_fk1";
ALTER TABLE "Progreso_Libro" ADD CONSTRAINT "Progreso_Libro_fk1" FOREIGN KEY ("alumno_id") REFERENCES "Alumno"("id");
ALTER TABLE "Progreso_Libro" DROP CONSTRAINT IF EXISTS "Progreso_Libro_fk2";
ALTER TABLE "Progreso_Libro" ADD CONSTRAINT "Progreso_Libro_fk2" FOREIGN KEY ("libro_id") REFERENCES "Libro"("id");

-- ============================================
-- PARTE 5: MIGRACIONES ADICIONALES (Libros, Unidades, Segmentos)
-- ============================================

ALTER TABLE "Libro" ADD COLUMN IF NOT EXISTS "estado" varchar(50) DEFAULT 'procesando';
ALTER TABLE "Libro" ADD COLUMN IF NOT EXISTS "num_paginas" bigint;

CREATE TABLE IF NOT EXISTS "Unidad" (
	"id" bigint NOT NULL,
	"libro_id" bigint NOT NULL,
	"nombre" varchar(150) NOT NULL,
	"orden" bigint NOT NULL DEFAULT 1,
	PRIMARY KEY ("id")
);

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

CREATE SEQUENCE IF NOT EXISTS "Unidad_id_seq";
ALTER TABLE "Unidad" ALTER COLUMN "id" SET DEFAULT nextval('"Unidad_id_seq"');
ALTER SEQUENCE "Unidad_id_seq" OWNED BY "Unidad"."id";

CREATE SEQUENCE IF NOT EXISTS "Segmento_id_seq";
ALTER TABLE "Segmento" ALTER COLUMN "id" SET DEFAULT nextval('"Segmento_id_seq"');
ALTER SEQUENCE "Segmento_id_seq" OWNED BY "Segmento"."id";

ALTER TABLE "Unidad" DROP CONSTRAINT IF EXISTS "Unidad_fk1";
ALTER TABLE "Unidad" ADD CONSTRAINT "Unidad_fk1" FOREIGN KEY ("libro_id") REFERENCES "Libro"("id") ON DELETE CASCADE;

ALTER TABLE "Segmento" DROP CONSTRAINT IF EXISTS "Segmento_fk1";
ALTER TABLE "Segmento" ADD CONSTRAINT "Segmento_fk1" FOREIGN KEY ("libro_id") REFERENCES "Libro"("id") ON DELETE CASCADE;
ALTER TABLE "Segmento" DROP CONSTRAINT IF EXISTS "Segmento_fk2";
ALTER TABLE "Segmento" ADD CONSTRAINT "Segmento_fk2" FOREIGN KEY ("unidad_id") REFERENCES "Unidad"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_unidad_libro_id" ON "Unidad"("libro_id");
CREATE INDEX IF NOT EXISTS "idx_segmento_libro_id" ON "Segmento"("libro_id");
CREATE INDEX IF NOT EXISTS "idx_segmento_unidad_id" ON "Segmento"("unidad_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_segmento_id_externo" ON "Segmento"("id_externo");

-- ============================================
-- PARTE 6: Libro - materia opcional, ruta PDF
-- ============================================

ALTER TABLE "Libro" ALTER COLUMN "materia_id" DROP NOT NULL;
ALTER TABLE "Libro" ADD COLUMN IF NOT EXISTS "ruta_pdf" varchar(512);

-- ============================================
-- PARTE 7: Escuela_Libro_Pendiente (doble verificación)
-- ============================================

CREATE TABLE IF NOT EXISTS "Escuela_Libro_Pendiente" (
  "id" BIGSERIAL PRIMARY KEY,
  "escuela_id" BIGINT NOT NULL REFERENCES "Escuela"("id") ON DELETE CASCADE,
  "libro_id" BIGINT NOT NULL REFERENCES "Libro"("id") ON DELETE CASCADE,
  "fecha_otorgado" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_escuela_libro_pendiente_uniq"
  ON "Escuela_Libro_Pendiente" ("escuela_id", "libro_id");

-- ============================================
-- PARTE 8: Unique escuela_id + libro_id en Escuela_Libro
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS "idx_escuela_libro_uniq"
  ON "Escuela_Libro" ("escuela_id", "libro_id");

-- ============================================
-- PARTE 9: Auditoría
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

-- ============================================
-- PARTE 10: Índices Director (si aplica)
-- ============================================

CREATE INDEX IF NOT EXISTS "idx_director_persona_id" ON "Director"("persona_id");
CREATE INDEX IF NOT EXISTS "idx_director_escuela_id" ON "Director"("escuela_id");

-- ============================================
-- PARTE 11: Seed - Materia Lectura (opcional)
-- ============================================

INSERT INTO "Materia" ("id", "nombre", "descripcion", "nivel")
VALUES (1, 'Lectura', 'Libros de lectura', 'General')
ON CONFLICT ("id") DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'Materia_id_seq') THEN
    PERFORM setval('"Materia_id_seq"', (SELECT COALESCE(MAX("id"), 1) FROM "Materia"));
  END IF;
END $$;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- Todas las tablas, secuencias, migraciones y seed han sido aplicadas.
-- Script único para instalar la base de datos desde cero.
-- ============================================
