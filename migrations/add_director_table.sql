-- ============================================
-- MIGRACIÓN: Agregar tabla Director
-- ============================================
-- Este script agrega la tabla Director y sus relaciones
-- Ejecuta este script después de complete_database_setup.sql
-- ============================================

-- ============================================
-- PARTE 1: CREAR TABLA Director
-- ============================================

CREATE TABLE IF NOT EXISTS "Director" (
	"id" bigint NOT NULL,
	"persona_id" bigint NOT NULL,
	"escuela_id" bigint NOT NULL,
	"fecha_nombramiento" date,
	PRIMARY KEY ("id")
);

-- ============================================
-- PARTE 2: CREAR SECUENCIA PARA Director
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

-- Configurar secuencia para Director
SELECT setup_sequence('Director', 'id');

-- Limpiar función auxiliar
DROP FUNCTION setup_sequence(text, text);

-- ============================================
-- PARTE 3: CREAR RELACIONES (FOREIGN KEYS)
-- ============================================

-- Relación Director -> Persona
ALTER TABLE "Director" DROP CONSTRAINT IF EXISTS "Director_fk1";
ALTER TABLE "Director" ADD CONSTRAINT "Director_fk1" FOREIGN KEY ("persona_id") REFERENCES "Persona"("id");

-- Relación Director -> Escuela
ALTER TABLE "Director" DROP CONSTRAINT IF EXISTS "Director_fk2";
ALTER TABLE "Director" ADD CONSTRAINT "Director_fk2" FOREIGN KEY ("escuela_id") REFERENCES "Escuela"("id");

-- ============================================
-- PARTE 4: CREAR ÍNDICES PARA MEJOR RENDIMIENTO
-- ============================================

CREATE INDEX IF NOT EXISTS "idx_director_persona_id" ON "Director"("persona_id");
CREATE INDEX IF NOT EXISTS "idx_director_escuela_id" ON "Director"("escuela_id");

-- ============================================
-- FIN DE LA MIGRACIÓN
-- ============================================
-- La tabla Director ha sido creada con sus relaciones
-- ============================================
