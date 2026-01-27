-- ============================================
-- SCRIPT COMPLETO DE CONFIGURACIÓN DE BASE DE DATOS
-- ============================================
-- Este script crea todas las tablas, secuencias, campos adicionales y relaciones
-- Ejecuta este script completo en tu base de datos PostgreSQL
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
-- FIN DEL SCRIPT
-- ============================================
-- Todas las tablas, secuencias, campos adicionales y relaciones han sido configuradas
-- ============================================
