--
-- PostgreSQL database dump
--

\restrict vAiBAV53v1gb5tOgM8nHrJz6V2gkXVA4gGt5fHaZBPtczNyOjWLqEFY7wG8eLiL

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Admin; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Admin" (
    id bigint NOT NULL,
    persona_id bigint NOT NULL,
    fecha_alta date
);


ALTER TABLE public."Admin" OWNER TO postgres;

--
-- Name: Admin_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Admin_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Admin_id_seq" OWNER TO postgres;

--
-- Name: Admin_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Admin_id_seq" OWNED BY public."Admin".id;


--
-- Name: Alumno; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Alumno" (
    ciclo_escolar character varying(20),
    id bigint NOT NULL,
    persona_id bigint NOT NULL,
    escuela_id bigint NOT NULL,
    padre_id bigint,
    grado bigint NOT NULL,
    grupo character varying(10),
    activo boolean DEFAULT true
);


ALTER TABLE public."Alumno" OWNER TO postgres;

--
-- Name: Alumno_Maestro; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Alumno_Maestro" (
    fecha_fin date,
    id bigint NOT NULL,
    alumno_id bigint NOT NULL,
    maestro_id bigint NOT NULL,
    materia_id bigint NOT NULL,
    fecha_inicio date NOT NULL
);


ALTER TABLE public."Alumno_Maestro" OWNER TO postgres;

--
-- Name: Alumno_Maestro_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Alumno_Maestro_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Alumno_Maestro_id_seq" OWNER TO postgres;

--
-- Name: Alumno_Maestro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Alumno_Maestro_id_seq" OWNED BY public."Alumno_Maestro".id;


--
-- Name: Alumno_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Alumno_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Alumno_id_seq" OWNER TO postgres;

--
-- Name: Alumno_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Alumno_id_seq" OWNED BY public."Alumno".id;


--
-- Name: Director; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Director" (
    id bigint NOT NULL,
    persona_id bigint NOT NULL,
    escuela_id bigint NOT NULL,
    fecha_nombramiento date,
    activo boolean DEFAULT true
);


ALTER TABLE public."Director" OWNER TO postgres;

--
-- Name: Director_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Director_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Director_id_seq" OWNER TO postgres;

--
-- Name: Director_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Director_id_seq" OWNED BY public."Director".id;


--
-- Name: Escuela; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Escuela" (
    id bigint NOT NULL,
    nombre character varying(150) NOT NULL,
    nivel character varying(50) NOT NULL,
    clave character varying(50),
    direccion character varying(200),
    telefono character varying(20),
    estado character varying(20) DEFAULT 'activa'::character varying,
    ciudad character varying(100),
    estado_region character varying(100)
);


ALTER TABLE public."Escuela" OWNER TO postgres;

--
-- Name: Escuela_Libro; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Escuela_Libro" (
    activo boolean,
    id bigint NOT NULL,
    escuela_id bigint NOT NULL,
    libro_id bigint NOT NULL,
    fecha_inicio date NOT NULL,
    fecha_fin date
);


ALTER TABLE public."Escuela_Libro" OWNER TO postgres;

--
-- Name: Escuela_Libro_Pendiente; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Escuela_Libro_Pendiente" (
    id bigint NOT NULL,
    escuela_id bigint NOT NULL,
    libro_id bigint NOT NULL,
    fecha_otorgado timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public."Escuela_Libro_Pendiente" OWNER TO postgres;

--
-- Name: TABLE "Escuela_Libro_Pendiente"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public."Escuela_Libro_Pendiente" IS 'Libros otorgados por admin a una escuela, pendientes de canje por la escuela';


--
-- Name: Escuela_Libro_Pendiente_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Escuela_Libro_Pendiente_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Escuela_Libro_Pendiente_id_seq" OWNER TO postgres;

--
-- Name: Escuela_Libro_Pendiente_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Escuela_Libro_Pendiente_id_seq" OWNED BY public."Escuela_Libro_Pendiente".id;


--
-- Name: Escuela_Libro_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Escuela_Libro_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Escuela_Libro_id_seq" OWNER TO postgres;

--
-- Name: Escuela_Libro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Escuela_Libro_id_seq" OWNED BY public."Escuela_Libro".id;


--
-- Name: Escuela_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Escuela_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Escuela_id_seq" OWNER TO postgres;

--
-- Name: Escuela_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Escuela_id_seq" OWNED BY public."Escuela".id;


--
-- Name: Evaluacion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Evaluacion" (
    id bigint NOT NULL,
    libro_id bigint NOT NULL,
    materia_id bigint NOT NULL,
    nombre character varying(150) NOT NULL,
    tipo character varying(50) NOT NULL,
    puntaje_maximo bigint NOT NULL
);


ALTER TABLE public."Evaluacion" OWNER TO postgres;

--
-- Name: Evaluacion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Evaluacion_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Evaluacion_id_seq" OWNER TO postgres;

--
-- Name: Evaluacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Evaluacion_id_seq" OWNED BY public."Evaluacion".id;


--
-- Name: Intento_Evaluacion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Intento_Evaluacion" (
    id bigint NOT NULL,
    alumno_id bigint NOT NULL,
    evaluacion_id bigint NOT NULL,
    puntaje_obtenido bigint,
    fecha timestamp without time zone
);


ALTER TABLE public."Intento_Evaluacion" OWNER TO postgres;

--
-- Name: Intento_Evaluacion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Intento_Evaluacion_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Intento_Evaluacion_id_seq" OWNER TO postgres;

--
-- Name: Intento_Evaluacion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Intento_Evaluacion_id_seq" OWNED BY public."Intento_Evaluacion".id;


--
-- Name: Juego; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Juego" (
    materia_id bigint NOT NULL,
    libro_id bigint NOT NULL,
    id bigint NOT NULL,
    nombre character varying(150) NOT NULL,
    descripcion character varying(255),
    nivel_dificultad character varying(50)
);


ALTER TABLE public."Juego" OWNER TO postgres;

--
-- Name: Juego_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Juego_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Juego_id_seq" OWNER TO postgres;

--
-- Name: Juego_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Juego_id_seq" OWNED BY public."Juego".id;


--
-- Name: Libro; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Libro" (
    titulo character varying(150) NOT NULL,
    materia_id bigint,
    id bigint NOT NULL,
    codigo character varying(50) NOT NULL,
    grado bigint NOT NULL,
    descripcion character varying(255),
    estado character varying(50) DEFAULT 'procesando'::character varying,
    num_paginas bigint,
    ruta_pdf character varying(512),
    activo boolean DEFAULT true
);


ALTER TABLE public."Libro" OWNER TO postgres;

--
-- Name: Libro_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Libro_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Libro_id_seq" OWNER TO postgres;

--
-- Name: Libro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Libro_id_seq" OWNED BY public."Libro".id;


--
-- Name: Maestro; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Maestro" (
    especialidad character varying(100),
    fecha_contratacion date,
    id bigint NOT NULL,
    persona_id bigint NOT NULL,
    escuela_id bigint NOT NULL,
    activo boolean DEFAULT true
);


ALTER TABLE public."Maestro" OWNER TO postgres;

--
-- Name: Maestro_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Maestro_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Maestro_id_seq" OWNER TO postgres;

--
-- Name: Maestro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Maestro_id_seq" OWNED BY public."Maestro".id;


--
-- Name: Materia; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Materia" (
    id bigint NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion character varying(255),
    nivel character varying(50)
);


ALTER TABLE public."Materia" OWNER TO postgres;

--
-- Name: Materia_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Materia_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Materia_id_seq" OWNER TO postgres;

--
-- Name: Materia_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Materia_id_seq" OWNED BY public."Materia".id;


--
-- Name: Opcion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Opcion" (
    id bigint NOT NULL,
    pregunta_id bigint NOT NULL,
    texto character varying(200) NOT NULL,
    es_correcta boolean
);


ALTER TABLE public."Opcion" OWNER TO postgres;

--
-- Name: Opcion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Opcion_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Opcion_id_seq" OWNER TO postgres;

--
-- Name: Opcion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Opcion_id_seq" OWNED BY public."Opcion".id;


--
-- Name: Padre; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Padre" (
    id bigint NOT NULL,
    persona_id bigint NOT NULL,
    parentesco character varying(50)
);


ALTER TABLE public."Padre" OWNER TO postgres;

--
-- Name: Padre_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Padre_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Padre_id_seq" OWNER TO postgres;

--
-- Name: Padre_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Padre_id_seq" OWNED BY public."Padre".id;


--
-- Name: Persona; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Persona" (
    nombre character varying(100) NOT NULL,
    apellido character varying(100) NOT NULL,
    correo character varying(150),
    telefono character varying(20),
    fecha_nacimiento date,
    genero character varying(30),
    id bigint NOT NULL,
    password character varying(255),
    tipo_persona character varying(50),
    activo boolean DEFAULT true
);


ALTER TABLE public."Persona" OWNER TO postgres;

--
-- Name: Persona_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Persona_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Persona_id_seq" OWNER TO postgres;

--
-- Name: Persona_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Persona_id_seq" OWNED BY public."Persona".id;


--
-- Name: Pregunta; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Pregunta" (
    id bigint NOT NULL,
    evaluacion_id bigint NOT NULL,
    texto character varying(255) NOT NULL,
    tipo character varying(100) NOT NULL,
    puntaje bigint
);


ALTER TABLE public."Pregunta" OWNER TO postgres;

--
-- Name: PreguntaSegmento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PreguntaSegmento" (
    id bigint NOT NULL,
    segmento_id bigint NOT NULL,
    nivel character varying(20) NOT NULL,
    texto_pregunta text NOT NULL,
    orden integer DEFAULT 1 NOT NULL
);


ALTER TABLE public."PreguntaSegmento" OWNER TO postgres;

--
-- Name: PreguntaSegmento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."PreguntaSegmento_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."PreguntaSegmento_id_seq" OWNER TO postgres;

--
-- Name: PreguntaSegmento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."PreguntaSegmento_id_seq" OWNED BY public."PreguntaSegmento".id;


--
-- Name: Pregunta_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Pregunta_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Pregunta_id_seq" OWNER TO postgres;

--
-- Name: Pregunta_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Pregunta_id_seq" OWNED BY public."Pregunta".id;


--
-- Name: Progreso_Juego; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Progreso_Juego" (
    id bigint NOT NULL,
    alumno_id bigint NOT NULL,
    juego_id bigint NOT NULL,
    nivel_alcanzado bigint,
    puntaje bigint,
    fecha timestamp without time zone
);


ALTER TABLE public."Progreso_Juego" OWNER TO postgres;

--
-- Name: Progreso_Juego_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Progreso_Juego_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Progreso_Juego_id_seq" OWNER TO postgres;

--
-- Name: Progreso_Juego_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Progreso_Juego_id_seq" OWNED BY public."Progreso_Juego".id;


--
-- Name: Progreso_Libro; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Progreso_Libro" (
    id bigint NOT NULL,
    alumno_id bigint NOT NULL,
    libro_id bigint NOT NULL,
    porcentaje bigint,
    actualizado timestamp without time zone
);


ALTER TABLE public."Progreso_Libro" OWNER TO postgres;

--
-- Name: Progreso_Libro_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Progreso_Libro_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Progreso_Libro_id_seq" OWNER TO postgres;

--
-- Name: Progreso_Libro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Progreso_Libro_id_seq" OWNED BY public."Progreso_Libro".id;


--
-- Name: Segmento; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Segmento" (
    id bigint NOT NULL,
    libro_id bigint NOT NULL,
    unidad_id bigint NOT NULL,
    contenido text NOT NULL,
    numero_pagina bigint,
    orden bigint DEFAULT 1 NOT NULL,
    id_externo character varying(100) NOT NULL
);


ALTER TABLE public."Segmento" OWNER TO postgres;

--
-- Name: Segmento_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Segmento_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Segmento_id_seq" OWNER TO postgres;

--
-- Name: Segmento_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Segmento_id_seq" OWNED BY public."Segmento".id;


--
-- Name: Unidad; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Unidad" (
    id bigint NOT NULL,
    libro_id bigint NOT NULL,
    nombre character varying(150) NOT NULL,
    orden bigint DEFAULT 1 NOT NULL
);


ALTER TABLE public."Unidad" OWNER TO postgres;

--
-- Name: Unidad_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Unidad_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Unidad_id_seq" OWNER TO postgres;

--
-- Name: Unidad_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Unidad_id_seq" OWNED BY public."Unidad".id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    accion character varying(80) NOT NULL,
    usuario_id bigint,
    ip character varying(45),
    detalles text,
    fecha timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_log OWNER TO postgres;

--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_log_id_seq OWNER TO postgres;

--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: Admin id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Admin" ALTER COLUMN id SET DEFAULT nextval('public."Admin_id_seq"'::regclass);


--
-- Name: Alumno id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Alumno" ALTER COLUMN id SET DEFAULT nextval('public."Alumno_id_seq"'::regclass);


--
-- Name: Alumno_Maestro id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Alumno_Maestro" ALTER COLUMN id SET DEFAULT nextval('public."Alumno_Maestro_id_seq"'::regclass);


--
-- Name: Director id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Director" ALTER COLUMN id SET DEFAULT nextval('public."Director_id_seq"'::regclass);


--
-- Name: Escuela id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Escuela" ALTER COLUMN id SET DEFAULT nextval('public."Escuela_id_seq"'::regclass);


--
-- Name: Escuela_Libro id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Escuela_Libro" ALTER COLUMN id SET DEFAULT nextval('public."Escuela_Libro_id_seq"'::regclass);


--
-- Name: Escuela_Libro_Pendiente id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Escuela_Libro_Pendiente" ALTER COLUMN id SET DEFAULT nextval('public."Escuela_Libro_Pendiente_id_seq"'::regclass);


--
-- Name: Evaluacion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Evaluacion" ALTER COLUMN id SET DEFAULT nextval('public."Evaluacion_id_seq"'::regclass);


--
-- Name: Intento_Evaluacion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Intento_Evaluacion" ALTER COLUMN id SET DEFAULT nextval('public."Intento_Evaluacion_id_seq"'::regclass);


--
-- Name: Juego id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Juego" ALTER COLUMN id SET DEFAULT nextval('public."Juego_id_seq"'::regclass);


--
-- Name: Libro id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Libro" ALTER COLUMN id SET DEFAULT nextval('public."Libro_id_seq"'::regclass);


--
-- Name: Maestro id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Maestro" ALTER COLUMN id SET DEFAULT nextval('public."Maestro_id_seq"'::regclass);


--
-- Name: Materia id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Materia" ALTER COLUMN id SET DEFAULT nextval('public."Materia_id_seq"'::regclass);


--
-- Name: Opcion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Opcion" ALTER COLUMN id SET DEFAULT nextval('public."Opcion_id_seq"'::regclass);


--
-- Name: Padre id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Padre" ALTER COLUMN id SET DEFAULT nextval('public."Padre_id_seq"'::regclass);


--
-- Name: Persona id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Persona" ALTER COLUMN id SET DEFAULT nextval('public."Persona_id_seq"'::regclass);


--
-- Name: Pregunta id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Pregunta" ALTER COLUMN id SET DEFAULT nextval('public."Pregunta_id_seq"'::regclass);


--
-- Name: PreguntaSegmento id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PreguntaSegmento" ALTER COLUMN id SET DEFAULT nextval('public."PreguntaSegmento_id_seq"'::regclass);


--
-- Name: Progreso_Juego id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Progreso_Juego" ALTER COLUMN id SET DEFAULT nextval('public."Progreso_Juego_id_seq"'::regclass);


--
-- Name: Progreso_Libro id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Progreso_Libro" ALTER COLUMN id SET DEFAULT nextval('public."Progreso_Libro_id_seq"'::regclass);


--
-- Name: Segmento id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Segmento" ALTER COLUMN id SET DEFAULT nextval('public."Segmento_id_seq"'::regclass);


--
-- Name: Unidad id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Unidad" ALTER COLUMN id SET DEFAULT nextval('public."Unidad_id_seq"'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: Admin Admin_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Admin"
    ADD CONSTRAINT "Admin_pkey" PRIMARY KEY (id);


--
-- Name: Alumno_Maestro Alumno_Maestro_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Alumno_Maestro"
    ADD CONSTRAINT "Alumno_Maestro_pkey" PRIMARY KEY (id);


--
-- Name: Alumno Alumno_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Alumno"
    ADD CONSTRAINT "Alumno_pkey" PRIMARY KEY (id);


--
-- Name: Director Director_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Director"
    ADD CONSTRAINT "Director_pkey" PRIMARY KEY (id);


--
-- Name: Escuela_Libro_Pendiente Escuela_Libro_Pendiente_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Escuela_Libro_Pendiente"
    ADD CONSTRAINT "Escuela_Libro_Pendiente_pkey" PRIMARY KEY (id);


--
-- Name: Escuela_Libro Escuela_Libro_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Escuela_Libro"
    ADD CONSTRAINT "Escuela_Libro_pkey" PRIMARY KEY (id);


--
-- Name: Escuela Escuela_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Escuela"
    ADD CONSTRAINT "Escuela_pkey" PRIMARY KEY (id);


--
-- Name: Evaluacion Evaluacion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Evaluacion"
    ADD CONSTRAINT "Evaluacion_pkey" PRIMARY KEY (id);


--
-- Name: Intento_Evaluacion Intento_Evaluacion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Intento_Evaluacion"
    ADD CONSTRAINT "Intento_Evaluacion_pkey" PRIMARY KEY (id);


--
-- Name: Juego Juego_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Juego"
    ADD CONSTRAINT "Juego_pkey" PRIMARY KEY (id);


--
-- Name: Libro Libro_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Libro"
    ADD CONSTRAINT "Libro_pkey" PRIMARY KEY (id);


--
-- Name: Maestro Maestro_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Maestro"
    ADD CONSTRAINT "Maestro_pkey" PRIMARY KEY (id);


--
-- Name: Materia Materia_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Materia"
    ADD CONSTRAINT "Materia_pkey" PRIMARY KEY (id);


--
-- Name: Opcion Opcion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Opcion"
    ADD CONSTRAINT "Opcion_pkey" PRIMARY KEY (id);


--
-- Name: Padre Padre_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Padre"
    ADD CONSTRAINT "Padre_pkey" PRIMARY KEY (id);


--
-- Name: Persona Persona_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Persona"
    ADD CONSTRAINT "Persona_pkey" PRIMARY KEY (id);


--
-- Name: PreguntaSegmento PreguntaSegmento_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PreguntaSegmento"
    ADD CONSTRAINT "PreguntaSegmento_pkey" PRIMARY KEY (id);


--
-- Name: Pregunta Pregunta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Pregunta"
    ADD CONSTRAINT "Pregunta_pkey" PRIMARY KEY (id);


--
-- Name: Progreso_Juego Progreso_Juego_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Progreso_Juego"
    ADD CONSTRAINT "Progreso_Juego_pkey" PRIMARY KEY (id);


--
-- Name: Progreso_Libro Progreso_Libro_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Progreso_Libro"
    ADD CONSTRAINT "Progreso_Libro_pkey" PRIMARY KEY (id);


--
-- Name: Segmento Segmento_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Segmento"
    ADD CONSTRAINT "Segmento_pkey" PRIMARY KEY (id);


--
-- Name: Unidad Unidad_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Unidad"
    ADD CONSTRAINT "Unidad_pkey" PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_log_accion; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_log_accion ON public.audit_log USING btree (accion);


--
-- Name: idx_audit_log_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_log_fecha ON public.audit_log USING btree (fecha DESC);


--
-- Name: idx_audit_log_usuario; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_log_usuario ON public.audit_log USING btree (usuario_id);


--
-- Name: idx_director_escuela_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_director_escuela_id ON public."Director" USING btree (escuela_id);


--
-- Name: idx_director_persona_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_director_persona_id ON public."Director" USING btree (persona_id);


--
-- Name: idx_escuela_libro_pendiente_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_escuela_libro_pendiente_uniq ON public."Escuela_Libro_Pendiente" USING btree (escuela_id, libro_id);


--
-- Name: idx_escuela_libro_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_escuela_libro_uniq ON public."Escuela_Libro" USING btree (escuela_id, libro_id);


--
-- Name: idx_persona_correo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persona_correo ON public."Persona" USING btree (correo);


--
-- Name: idx_pregunta_segmento_nivel; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pregunta_segmento_nivel ON public."PreguntaSegmento" USING btree (segmento_id, nivel);


--
-- Name: idx_pregunta_segmento_segmento_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pregunta_segmento_segmento_id ON public."PreguntaSegmento" USING btree (segmento_id);


--
-- Name: idx_segmento_id_externo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_segmento_id_externo ON public."Segmento" USING btree (id_externo);


--
-- Name: idx_segmento_libro_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_segmento_libro_id ON public."Segmento" USING btree (libro_id);


--
-- Name: idx_segmento_unidad_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_segmento_unidad_id ON public."Segmento" USING btree (unidad_id);


--
-- Name: idx_unidad_libro_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_unidad_libro_id ON public."Unidad" USING btree (libro_id);


--
-- Name: Admin Admin_fk1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Admin"
    ADD CONSTRAINT "Admin_fk1" FOREIGN KEY (persona_id) REFERENCES public."Persona"(id);


--
-- Name: Alumno_Maestro Alumno_Maestro_fk2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Alumno_Maestro"
    ADD CONSTRAINT "Alumno_Maestro_fk2" FOREIGN KEY (alumno_id) REFERENCES public."Alumno"(id);


--
-- Name: Alumno_Maestro Alumno_Maestro_fk3; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Alumno_Maestro"
    ADD CONSTRAINT "Alumno_Maestro_fk3" FOREIGN KEY (maestro_id) REFERENCES public."Maestro"(id);


--
-- Name: Alumno_Maestro Alumno_Maestro_fk4; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Alumno_Maestro"
    ADD CONSTRAINT "Alumno_Maestro_fk4" FOREIGN KEY (materia_id) REFERENCES public."Materia"(id);


--
-- Name: Alumno Alumno_fk2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Alumno"
    ADD CONSTRAINT "Alumno_fk2" FOREIGN KEY (persona_id) REFERENCES public."Persona"(id);


--
-- Name: Alumno Alumno_fk3; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Alumno"
    ADD CONSTRAINT "Alumno_fk3" FOREIGN KEY (escuela_id) REFERENCES public."Escuela"(id);


--
-- Name: Alumno Alumno_fk4; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Alumno"
    ADD CONSTRAINT "Alumno_fk4" FOREIGN KEY (padre_id) REFERENCES public."Padre"(id);


--
-- Name: Director Director_fk1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Director"
    ADD CONSTRAINT "Director_fk1" FOREIGN KEY (persona_id) REFERENCES public."Persona"(id);


--
-- Name: Director Director_fk2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Director"
    ADD CONSTRAINT "Director_fk2" FOREIGN KEY (escuela_id) REFERENCES public."Escuela"(id);


--
-- Name: Escuela_Libro_Pendiente Escuela_Libro_Pendiente_escuela_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Escuela_Libro_Pendiente"
    ADD CONSTRAINT "Escuela_Libro_Pendiente_escuela_id_fkey" FOREIGN KEY (escuela_id) REFERENCES public."Escuela"(id) ON DELETE CASCADE;


--
-- Name: Escuela_Libro_Pendiente Escuela_Libro_Pendiente_libro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Escuela_Libro_Pendiente"
    ADD CONSTRAINT "Escuela_Libro_Pendiente_libro_id_fkey" FOREIGN KEY (libro_id) REFERENCES public."Libro"(id) ON DELETE CASCADE;


--
-- Name: Escuela_Libro Escuela_Libro_fk2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Escuela_Libro"
    ADD CONSTRAINT "Escuela_Libro_fk2" FOREIGN KEY (escuela_id) REFERENCES public."Escuela"(id);


--
-- Name: Escuela_Libro Escuela_Libro_fk3; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Escuela_Libro"
    ADD CONSTRAINT "Escuela_Libro_fk3" FOREIGN KEY (libro_id) REFERENCES public."Libro"(id);


--
-- Name: Evaluacion Evaluacion_fk1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Evaluacion"
    ADD CONSTRAINT "Evaluacion_fk1" FOREIGN KEY (libro_id) REFERENCES public."Libro"(id);


--
-- Name: Evaluacion Evaluacion_fk2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Evaluacion"
    ADD CONSTRAINT "Evaluacion_fk2" FOREIGN KEY (materia_id) REFERENCES public."Materia"(id);


--
-- Name: Intento_Evaluacion Intento_Evaluacion_fk1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Intento_Evaluacion"
    ADD CONSTRAINT "Intento_Evaluacion_fk1" FOREIGN KEY (alumno_id) REFERENCES public."Alumno"(id);


--
-- Name: Intento_Evaluacion Intento_Evaluacion_fk2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Intento_Evaluacion"
    ADD CONSTRAINT "Intento_Evaluacion_fk2" FOREIGN KEY (evaluacion_id) REFERENCES public."Evaluacion"(id);


--
-- Name: Juego Juego_fk0; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Juego"
    ADD CONSTRAINT "Juego_fk0" FOREIGN KEY (materia_id) REFERENCES public."Materia"(id);


--
-- Name: Juego Juego_fk1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Juego"
    ADD CONSTRAINT "Juego_fk1" FOREIGN KEY (libro_id) REFERENCES public."Libro"(id);


--
-- Name: Libro Libro_fk1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Libro"
    ADD CONSTRAINT "Libro_fk1" FOREIGN KEY (materia_id) REFERENCES public."Materia"(id);


--
-- Name: Maestro Maestro_fk3; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Maestro"
    ADD CONSTRAINT "Maestro_fk3" FOREIGN KEY (persona_id) REFERENCES public."Persona"(id);


--
-- Name: Maestro Maestro_fk4; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Maestro"
    ADD CONSTRAINT "Maestro_fk4" FOREIGN KEY (escuela_id) REFERENCES public."Escuela"(id);


--
-- Name: Opcion Opcion_fk1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Opcion"
    ADD CONSTRAINT "Opcion_fk1" FOREIGN KEY (pregunta_id) REFERENCES public."Pregunta"(id);


--
-- Name: Padre Padre_fk1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Padre"
    ADD CONSTRAINT "Padre_fk1" FOREIGN KEY (persona_id) REFERENCES public."Persona"(id);


--
-- Name: PreguntaSegmento PreguntaSegmento_fk1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PreguntaSegmento"
    ADD CONSTRAINT "PreguntaSegmento_fk1" FOREIGN KEY (segmento_id) REFERENCES public."Segmento"(id) ON DELETE CASCADE;


--
-- Name: Pregunta Pregunta_fk1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Pregunta"
    ADD CONSTRAINT "Pregunta_fk1" FOREIGN KEY (evaluacion_id) REFERENCES public."Evaluacion"(id);


--
-- Name: Progreso_Juego Progreso_Juego_fk1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Progreso_Juego"
    ADD CONSTRAINT "Progreso_Juego_fk1" FOREIGN KEY (alumno_id) REFERENCES public."Alumno"(id);


--
-- Name: Progreso_Juego Progreso_Juego_fk2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Progreso_Juego"
    ADD CONSTRAINT "Progreso_Juego_fk2" FOREIGN KEY (juego_id) REFERENCES public."Juego"(id);


--
-- Name: Progreso_Libro Progreso_Libro_fk1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Progreso_Libro"
    ADD CONSTRAINT "Progreso_Libro_fk1" FOREIGN KEY (alumno_id) REFERENCES public."Alumno"(id);


--
-- Name: Progreso_Libro Progreso_Libro_fk2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Progreso_Libro"
    ADD CONSTRAINT "Progreso_Libro_fk2" FOREIGN KEY (libro_id) REFERENCES public."Libro"(id);


--
-- Name: Segmento Segmento_fk1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Segmento"
    ADD CONSTRAINT "Segmento_fk1" FOREIGN KEY (libro_id) REFERENCES public."Libro"(id) ON DELETE CASCADE;


--
-- Name: Segmento Segmento_fk2; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Segmento"
    ADD CONSTRAINT "Segmento_fk2" FOREIGN KEY (unidad_id) REFERENCES public."Unidad"(id) ON DELETE CASCADE;


--
-- Name: Unidad Unidad_fk1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Unidad"
    ADD CONSTRAINT "Unidad_fk1" FOREIGN KEY (libro_id) REFERENCES public."Libro"(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict vAiBAV53v1gb5tOgM8nHrJz6V2gkXVA4gGt5fHaZBPtczNyOjWLqEFY7wG8eLiL

