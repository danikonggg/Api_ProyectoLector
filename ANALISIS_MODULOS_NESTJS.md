# Análisis Completo de Módulos NestJS - ApiLector

## 📋 Resumen Ejecutivo

El proyecto contiene **14 módulos de negocio** + **4 módulos de infraestructura**.
- **Complejidad total:** Alta (múltiples dependencias cíclicas)
- **Entidades:** 28 totales
- **Servicios:** 37 totales
- **Patrón actual:** TypeORM + Servicios (sin Repositories explícitos)

---

## 🏗️ LISTA DE MÓDULOS

### Módulos de Negocio (14)

| # | Módulo | Ruta | Estado |
|---|--------|------|--------|
| 1 | Personas | `src/personas/` | Usado por Auth, Admin, Director, Maestros |
| 2 | Auth | `src/auth/` | Guard global, depende de Personas |
| 3 | Escuelas | `src/escuelas/` | Hub central, múltiples dependencias |
| 4 | Libros | `src/libros/` | Procesamiento de PDFs |
| 5 | LibrosCoreModule | `src/libros/libros-core.module.ts` | Lógica compartida con worker |
| 6 | Licencias | `src/licencias/` | Gestión de licencias por alumno |
| 7 | Alumno | `src/alumno/` | Estadísticas y preferencias |
| 8 | Maestros | `src/maestros/` | Gestión de alumnos por maestro |
| 9 | Materias | `src/materias/` | CRUD simple |
| 10 | Audit | `src/audit/` | Módulo Global |
| 11 | Admin | `src/admin/` | Panel de administración |
| 12 | Director | `src/director/` | Gestión por director |
| 13 | Profesor | `src/profesor/` | Gestión por profesor |
| 14 | Groq | `src/groq/` | Integración con IA (generación de preguntas) |

### Módulos de Infraestructura (4)

| Módulo | Descripción |
|--------|-------------|
| PrismaModule | Cliente ORM (migración en proceso) |
| RedisModule | Cache y colas |
| QueuesModule | Procesamiento con BullMQ |
| ConfigModule | Configuración global |

---

## 📊 ANÁLISIS DETALLADO POR MÓDULO

### 1. **GROQ** - ⭐ MÁS SIMPLE
**Complejidad:** ⭐ (Trivial)  
**Ubicación:** `src/groq/`

#### Estructura:
- **Servicios:** 1
  - `groq.service.ts` - Integración con API Groq
- **Controladores:** 1
  - `groq.controller.ts`
- **Entidades:** 0 (sin persistencia)
- **DTOs:** `dto/`

#### Dependencias:
- ✅ **Ninguna** (módulo independiente)
- Usado por: `LibrosCoreModule` (para generar preguntas)

#### Complejidad: Baja
```
Groq
└── (sin dependencias)
```

---

### 2. **MATERIAS** - ⭐ MUY SIMPLE
**Complejidad:** ⭐ (Simple)  
**Ubicación:** `src/materias/`

#### Estructura:
- **Servicios:** 1
  - `materias.service.ts`
- **Controladores:** 1
  - `materias.controller.ts`
- **Entidades:** 1
  - `materia.entity.ts`

#### Dependencias:
- ✅ **Ninguna en módulos** (solo TypeORM)
- Usado por: `Personas`, `LibrosCoreModule`

#### Complejidad: Baja
```
Materias
├── 1 Service
├── 1 Entity (Materia)
└── 1 Controller
```

---

### 3. **AUDIT** - ⭐ SIMPLE (Módulo Global)
**Complejidad:** ⭐ (Simple)  
**Ubicación:** `src/audit/`  
**Marcado:** `@Global()` en el módulo

#### Estructura:
- **Servicios:** 1
  - `audit.service.ts`
- **Controladores:** 1
  - `audit.controller.ts`
- **Entidades:** 1
  - `audit-log.entity.ts`
- **Interceptores:** `audit-http.interceptor.ts`

#### Dependencias:
- ✅ **Ninguna** (excepto TypeORM)
- ✅ **Exportado globalmente** - accesible desde cualquier módulo

#### Complejidad: Baja
```
Audit (GLOBAL)
├── 1 Service
├── 1 Entity (AuditLog)
├── 1 Interceptor HTTP
└── 1 Controller
```

---

### 4. **PERSONAS** - 🔥 COMPLEJO (Base de datos de usuarios)
**Complejidad:** 🔥 (Complejo)  
**Ubicación:** `src/personas/`

#### Estructura:
- **Servicios:** 5
  - `carga-masiva.service.ts` - Importación masiva de usuarios
  - `services/registro-personas.service.ts`
  - `services/consulta-personas.service.ts`
  - `services/gestion-personas.service.ts`
  - `services/vinculacion-padres.service.ts`

- **Controladores:** 1
  - `personas.controller.ts`

- **Entidades:** 10 (modelo de usuarios complejo)
  - `persona.entity.ts` - Base
  - `administrador.entity.ts`
  - `padre.entity.ts`
  - `alumno.entity.ts`
  - `maestro.entity.ts`
  - `director.entity.ts`
  - `escuela.entity.ts`
  - `materia.entity.ts`
  - `alumno-maestro.entity.ts` (relación)
  - `alumno-vinculacion-padre.entity.ts` (relación)

- **DTOs:** `dto/`
- **Mappers:** `mappers/`

#### Dependencias:
- 📍 **Importa:** `AuthModule`
- ✅ **Exporta servicios** para uso en otros módulos
- **Usado por:** Auth, Admin, Director, Maestros

#### Complejidad: Alta
```
Personas (BASE)
├── 5 Servicios
├── 10 Entidades (modelo jerárquico)
├── Herencia: Persona → Alumno, Maestro, Director, Administrador
├── Relaciones: AlumnoMaestro, AlumnoVinculacionPadre
└── Dependencia: AuthModule
```

---

### 5. **AUTH** - 🔥 COMPLEJO (Autenticación global)
**Complejidad:** 🔥 (Complejo - Múltiples Guards/Strategies)  
**Ubicación:** `src/auth/`

#### Estructura:
- **Servicios:** 1 principal + 1 adicional
  - `auth.service.ts`
  - `services/jwt-persona-loader.service.ts`

- **Controladores:** 1
  - `auth.controller.ts`

- **Estrategias:** `strategies/jwt.strategy.ts`
- **Guards:** `guards/jwt-auth.guard.ts`
- **Decoradores:** `decorators/`
- **DTOs:** `dto/`

- **Entidades:** 2 (solo lectura)
  - `persona.entity.ts` (de Personas)
  - `administrador.entity.ts` (de Personas)

#### Dependencias:
- 📍 **Importa:** `PersonasModule`, JwtModule, PassportModule
- ✅ **Exporta:** AuthService, JwtModule, JwtAuthGuard
- **Registrado como:** `APP_GUARD` en AppModule

#### Complejidad: Alta
```
Auth
├── AuthService + JwtPersonaLoaderService
├── JwtStrategy
├── JwtAuthGuard (aplicado globalmente)
├── Decoradores personalizados
└── Dependencia: PersonasModule
```

---

### 6. **LIBROS-CORE** - 🔥 EXTREMADAMENTE COMPLEJO
**Complejidad:** 🔥🔥 (Procesamiento pesado de PDFs)  
**Ubicación:** `src/libros/libros-core.module.ts`

#### Estructura:
- **Servicios:** 7 especializados
  - `libros-pdf.service.ts` - Parseo de PDFs
  - `libros-pdf-imagenes.service.ts` - Extracción de imágenes
  - `supabase-storage.service.ts` - Almacenamiento en la nube
  - `libro-procesamiento.service.ts` - Orquestación principal
  - `libro-upload-validation.service.ts` - Validación
  - `glosario-segmento.service.ts` - Generación de glosario
  - `preguntas-segmento.service.ts` - Generación de preguntas

- **Entidades:** 6
  - `libro.entity.ts` - Libro principal
  - `unidad.entity.ts` - Unidades del libro
  - `segmento.entity.ts` - Segmentos (párrafos)
  - `pregunta-segmento.entity.ts` - Preguntas por segmento
  - `glosario.entity.ts` - Glosario
  - `seccion-glosario.entity.ts` - Secciones del glosario

- **Utilidades:** `pdf-text-cleaner.ts`

#### Dependencias:
- 📍 **Importa:** `GroqModule` (para generar preguntas)
- ✅ **Exporta:** Múltiples servicios para uso en API y Worker
- **Usado por:** `LibrosModule`, `EscuelasModule`

#### Complejidad: Extremadamente Alta
```
LibrosCoreModule (COMPARTIDA: API + Worker)
├── 7 Servicios especializados
│   ├── PDFService (conversión de PDF)
│   ├── SupabaseStorageService (almacenamiento)
│   ├── ProcesadorService (orquestación)
│   ├── ValidadorService
│   ├── GlosarioService
│   ├── PreguntasService
│   └── ImagenesService
├── 6 Entidades
├── Lógica pesada y procesamiento
└── Dependencia: GroqModule
```

---

### 7. **LIBROS** - 🔥 COMPLEJO (HTTP + Procesamiento)
**Complejidad:** 🔥 (Complejo)  
**Ubicación:** `src/libros/`

#### Estructura:
- **Servicios:** 1 principal
  - `libros.service.ts` - Orquestación HTTP

- **Controladores:** 1
  - `libros.controller.ts`

- **Módulos importados:** `LibrosCoreModule` (que contiene la lógica pesada)

- **Constantes:** `constants/`
- **DTOs:** `dto/`
- **Procesadores:** `processors/` (worker integration)

#### Dependencias:
- 📍 **Importa:** `EscuelasModule`, `LibrosCoreModule`
- ✅ **Exporta:** LibrosService

#### Complejidad: Alta
```
Libros (HTTP layer)
├── 1 Servicio (coordinador)
├── 1 Controlador
└── Dependencias:
    ├── EscuelasModule
    └── LibrosCoreModule (7 servicios + 6 entities)
```

---

### 8. **LICENCIAS** - 🟡 MEDIO
**Complejidad:** 🟡 (Medio)  
**Ubicación:** `src/licencias/`

#### Estructura:
- **Servicios:** 2
  - `licencias.service.ts` - CRUD de licencias
  - `licencias-auto-archiver.service.ts` - Limpieza automática

- **Controladores:** 1
  - `licencias.controller.ts`

- **Entidades:** 2
  - `licencia-libro.entity.ts` - Licencia activa
  - `licencia-libro-archivada.entity.ts` - Licencia archivada

- **Use Cases:** `application/listar-libros-disponibles.use-case.ts`

#### Dependencias:
- ✅ **Ninguna en módulos NestJS**
- 📍 **Importa entidades de:** Escuelas, Libros, Personas
- **Usado por:** `EscuelasModule`

#### Complejidad: Media
```
Licencias
├── 2 Servicios
├── 2 Entidades
├── 1 UseCase
└── Sin dependencias en módulos
```

---

### 9. **ESCUELAS** - 🔥🔥 MÁS COMPLEJO (Hub central)
**Complejidad:** 🔥🔥 (El más complejo - Dependencias múltiples)  
**Ubicación:** `src/escuelas/`

#### Estructura:
- **Servicios:** 6
  - `escuelas.service.ts` - CRUD principal
  - `services/estadisticas-escuela.service.ts` - Reportes
  - `services/consulta-escuela.service.ts` - Consultas
  - `services/alumno-evaluacion-segmento.service.ts` - Evaluación
  - `services/alumno-anotaciones-progreso.service.ts` - Anotaciones
  - `services/alumno-sesiones-lectura.service.ts` - Sesiones

- **Controladores:** 3
  - `escuelas.controller.ts`
  - `alumno-anotaciones.controller.ts`
  - `mis-libros-interacciones.controller.ts`

- **Entidades:** 7
  - `escuela-libro.entity.ts` - Libros asignados a escuela
  - `alumno-libro.entity.ts` - Libros asignados a alumno
  - `grupo.entity.ts` - Grupos de alumnos
  - `maestro-grupo.entity.ts` - Maestros por grupo
  - `anotacion.entity.ts` - Anotaciones del alumno
  - `alumno-segmento-evaluacion.entity.ts` - Evaluación por segmento
  - `escuela-libro-pendiente.entity.ts` - Libros en procesamiento

- **Use Cases:** `application/`
- **DTOs:** `dto/`

#### Dependencias:
- 📍 **Importa:** `PersonasModule`, `LicenciasModule`, `LibrosCoreModule`
- ✅ **Exporta:** EscuelasService
- **Usado por:** Libros, Maestros, Admin, Director

#### Complejidad: Extremadamente Alta
```
Escuelas (HUB CENTRAL)
├── 6 Servicios
├── 7 Entidades
├── 3 Controladores
├── Múltiples Use Cases
└── Dependencias:
    ├── PersonasModule (10 entidades)
    ├── LicenciasModule
    └── LibrosCoreModule (7 servicios)
```

---

### 10. **MAESTROS** - 🟡 MEDIO
**Complejidad:** 🟡 (Medio)  
**Ubicación:** `src/maestros/`

#### Estructura:
- **Servicios:** 1
  - `maestros.service.ts` - Gestión de alumnos por maestro

- **Controladores:** 1
  - `maestros.controller.ts`

- **Entidades:** 5 (imported)
  - `alumno.entity.ts`
  - `maestro.entity.ts`
  - `materia.entity.ts`
  - `alumno-maestro.entity.ts`
  - `maestro-grupo.entity.ts`
  - `grupo.entity.ts`

- **DTOs:** `dto/`

#### Dependencias:
- 📍 **Importa:** `EscuelasModule`
- ✅ **Exporta:** MaestrosService

#### Complejidad: Media
```
Maestros
├── 1 Servicio
├── 6 Entidades (importadas)
├── 1 Controlador
└── Dependencia: EscuelasModule
```

---

### 11. **ALUMNO** - ⭐ SIMPLE
**Complejidad:** ⭐ (Simple)  
**Ubicación:** `src/alumno/`

#### Estructura:
- **Servicios:** 2
  - `alumno-estadisticas.service.ts` - Estadísticas de lectura
  - `alumno-preferencias.service.ts` - Preferencias personales

- **Controladores:** 2
  - `alumno-estadisticas.controller.ts`
  - `alumno-preferencias.controller.ts`

- **Entidades:** 2
  - `preferencias-alumno.entity.ts`
  - `sesion-lectura.entity.ts`

- **DTOs:** `dto/`

#### Dependencias:
- ✅ **Ninguna** (módulo independiente)
- 📍 **Usa entidades de:** Escuelas (importadas)

#### Complejidad: Baja
```
Alumno
├── 2 Servicios
├── 2 Entidades
├── 2 Controladores
└── Sin dependencias en módulos
```

---

### 12. **PROFESOR** - ⭐ SIMPLE
**Complejidad:** ⭐ (Simple)  
**Ubicación:** `src/profesor/`

#### Estructura:
- **Servicios:** 1
  - `profesor.service.ts` - Vista de profesor

- **Controladores:** 1
  - `profesor.controller.ts`

- **Entidades:** 4 (imported)
  - `maestro-grupo.entity.ts`
  - `grupo.entity.ts`
  - `alumno.entity.ts`
  - `alumno-libro.entity.ts`
  - `sesion-lectura.entity.ts`

- **DTOs:** `dto/`

#### Dependencias:
- ✅ **Ninguna** (módulo independiente)

#### Complejidad: Baja
```
Profesor
├── 1 Servicio
├── 5 Entidades (importadas)
├── 1 Controlador
└── Sin dependencias
```

---

### 13. **ADMIN** - 🟡 MEDIO
**Complejidad:** 🟡 (Medio)  
**Ubicación:** `src/admin/`

#### Estructura:
- **Servicios:** 1
  - `admin.service.ts` - Panel administrativo

- **Controladores:** 1
  - `admin.controller.ts`

- **Entidades:** 4 (imported)
  - `escuela.entity.ts`
  - `alumno.entity.ts`
  - `maestro.entity.ts`
  - `libro.entity.ts`

#### Dependencias:
- 📍 **Importa:** `PersonasModule`, `EscuelasModule`
- ✅ **No exporta** (solo consumidor)

#### Complejidad: Media
```
Admin
├── 1 Servicio
├── 1 Controlador
├── 4 Entidades (importadas)
└── Dependencias:
    ├── PersonasModule
    └── EscuelasModule
```

---

### 14. **DIRECTOR** - 🟡 MEDIO
**Complejidad:** 🟡 (Medio)  
**Ubicación:** `src/director/`

#### Estructura:
- **Servicios:** 1
  - `director.service.ts` - Gestión directorial

- **Controladores:** 1
  - `director.controller.ts`

- **Entidades:** 6 (imported)
  - `escuela.entity.ts`
  - `alumno.entity.ts`
  - `maestro.entity.ts`
  - `escuela-libro.entity.ts`
  - `grupo.entity.ts`
  - `maestro-grupo.entity.ts`

- **DTOs:** `dto/`

#### Dependencias:
- 📍 **Importa:** `PersonasModule`, `EscuelasModule`
- ✅ **No exporta**

#### Complejidad: Media
```
Director
├── 1 Servicio
├── 1 Controlador
├── 6 Entidades (importadas)
└── Dependencias:
    ├── PersonasModule
    └── EscuelasModule
```

---

## 🔗 MAPA DE DEPENDENCIAS ENTRE MÓDULOS

```
┌─────────────────────────────────────────────────────────────┐
│                      GRAFO DE DEPENDENCIAS                   │
└─────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   GroqModule    │ (Sin dependencias)
                    └────────┬────────┘
                             │
                             ▼
                ┌──────────────────────────┐
                │  LibrosCoreModule        │
                │  (Procesamiento pesado)  │
                └────────┬─────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────────┐
    │ LibrosM  │  │LicenM    │  │ PersonasM    │
    └────┬─────┘  └────┬─────┘  └────┬─────────┘
         │             │             │
         │      ┌──────┴─────┐       │
         │      │            │       │
         ▼      ▼            ▼       ▼
    ┌────────────────────────────────────┐
    │       EscuelasModule (HUB)         │  ◄── Más complejo
    │    (7 entities, 6 services)        │
    └────────┬───────────────────────────┘
             │
    ┌────────┼──────────┬──────────┐
    │        │          │          │
    ▼        ▼          ▼          ▼
  AuthM   MaestrosM  AdminM   DirectorM

┌──────────────────────────────────────────────────────────────┐
│                    LEYENDA DE COMPLEJIDAD                    │
├──────────────────────────────────────────────────────────────┤
│ ⭐  SIMPLE       (1 servicio, 1-2 entidades)                │
│ 🟡  MEDIO       (2-3 servicios, 3-5 entidades)              │
│ 🔥  COMPLEJO    (4+ servicios, 5+ entidades)                │
│ 🔥🔥 MUY COMPLEJO (múltiples dependencias, lógica pesada)    │
└──────────────────────────────────────────────────────────────┘
```

---

## 📈 MATRIZ DE DEPENDENCIAS

|             | Personas | Auth | Libros | LibrosCoreM | Escuelas | Licencias | Groq |
|-------------|:--------:|:----:|:------:|:-----------:|:--------:|:---------:|:----:|
| **Auth**    |   ✅     |      |        |             |          |           |      |
| **Libros**  |          |      |        |      ✅     |    ✅    |           |      |
| **Escuelas**|   ✅     |      |   ✅   |      ✅     |          |     ✅    |      |
| **Maestros**|          |      |        |             |    ✅    |           |      |
| **Admin**   |   ✅     |      |        |             |    ✅    |           |      |
| **Director**|   ✅     |      |        |             |    ✅    |           |      |
| **Groq**    |          |      |        |             |          |           |      |

---

## 🎯 CLASIFICACIÓN POR COMPLEJIDAD

### Nivel 1: MUY SIMPLE (Migración inmediata) ⭐
1. **Groq** - 0 dependencias, sin persistencia
2. **Materias** - 1 entity, 1 service
3. **Audit** - Global, 1 entity, 1 service
4. **Alumno** - 2 entities, 2 services, sin dependencias
5. **Profesor** - 1 service, sin dependencias módulos

**Criterio:** Sin dependencias complejas, lógica simple

---

### Nivel 2: SIMPLE (Migración prioritaria) 🟡
6. **Licencias** - 2 entities, 2 services
7. **Maestros** - Depende solo de EscuelasModule
8. **Admin** - Depende de Personas + Escuelas
9. **Director** - Depende de Personas + Escuelas

**Criterio:** Pocas dependencias, lógica moderada

---

### Nivel 3: COMPLEJO (Migración cuidadosa) 🔥
10. **Personas** - 10 entities, 5 services (base)
11. **Auth** - Múltiples guards, depende de Personas
12. **LibrosCoreModule** - 7 services, procesamiento pesado
13. **Libros** - Coordinación HTTP + procesamiento

**Criterio:** Muchas entidades, lógica especializada

---

### Nivel 4: MÁS COMPLEJO (Migración final) 🔥🔥
14. **Escuelas** - Hub central, 7 entities, 6 services
    - Depende de: Personas, Licencias, LibrosCoreModule
    - Usado por: Libros, Maestros, Admin, Director

**Criterio:** Dependencias múltiples, punto central de conexión

---

## 📋 ORDEN DE MIGRACIÓN RECOMENDADO (Simple a Complejo)

### Fase 1: Fundación (Módulos sin dependencias)
```
1. Groq                    (sin dependencias, sin entidades)
2. Materias                (sin dependencias módulos)
3. Audit                   (global, sin dependencias)
4. Alumno                  (sin dependencias módulos)
5. Profesor                (sin dependencias módulos)
```

**Esfuerzo:** Bajo | **Riesgo:** Muy bajo | **Duración:** 1-2 días

---

### Fase 2: Servicios de Usuario (Base de datos)
```
6. Personas                (base para Auth, Admin, Director)
7. Auth                    (depende de Personas)
```

**Esfuerzo:** Alto | **Riesgo:** Medio | **Duración:** 2-3 días

---

### Fase 3: Gestión de Libros (Procesamiento)
```
8. Licencias               (depende de entidades, no módulos)
9. LibrosCoreModule        (7 services, procesamiento pesado)
10. Libros                 (HTTP layer + procesamiento)
```

**Esfuerzo:** Alto | **Riesgo:** Alto (cambios múltiples) | **Duración:** 3-5 días

---

### Fase 4: Hub Central (Punto crítico)
```
11. Escuelas               (depende de Personas, Licencias, LibrosCoreModule)
```

**Esfuerzo:** Muy alto | **Riesgo:** Alto (conexiones múltiples) | **Duración:** 3-4 días

---

### Fase 5: Funcionalidades Dependientes
```
12. Maestros              (depende de Escuelas)
13. Admin                 (depende de Personas, Escuelas)
14. Director              (depende de Personas, Escuelas)
```

**Esfuerzo:** Medio | **Riesgo:** Bajo | **Duración:** 2-3 días

---

## 🚨 CONSIDERACIONES IMPORTANTES

### Dependencias Cíclicas Detectadas
- ❌ **Escuelas ← → Libros** (relación fuerte)
- ❌ **Escuelas ← → Personas** (relación esperada)

### Módulos Críticos para Mantener
1. **Escuelas** - Hub central, cambios aquí afectan todo
2. **Personas** - Base de usuarios, usado por múltiples módulos
3. **Auth** - Guard global, afecta todas las rutas

### Estrategia de Migración TypeORM → Prisma
Según el archivo `prisma-setup.md` en la sesión:
- ✅ Prisma ya está configurado
- ✅ PrismaService creado en `src/infra/prisma/`
- ✅ Schema generado automáticamente desde DB
- 📋 Próximo paso: Migrar módulos uno por uno

**Recomendación:** Mantener TypeORM y Prisma en paralelo durante la transición en módulos que dependen de otros.

---

## 📊 ESTADÍSTICAS FINALES

| Métrica | Valor |
|---------|-------|
| **Total de módulos** | 14 (negocio) + 4 (infra) |
| **Total de entidades** | 28 |
| **Total de servicios** | 37+ |
| **Controllers** | 16+ |
| **Módulos sin dependencias** | 5 |
| **Módulos con 1+ dependencia** | 9 |
| **Módulos con 2+ dependencias** | 4 |
| **Módulos con 3+ dependencias** | 1 (Escuelas) |
| **Líneas de código (estimado)** | 15,000+ |

---

## 🔑 CONCLUSIÓN

**El proyecto es complejo pero bien estructurado:**

✅ **Fortalezas:**
- Separación clara de responsabilidades por módulo
- Estructura de capas (Controller → Service → Entity)
- Módulos reutilizables (especialmente LibrosCoreModule)

⚠️ **Áreas de atención:**
- **Escuelas** como punto central crea cuello de botella
- Algunas dependencias cíclicas (Escuelas ↔ Libros)
- Migración TypeORM → Prisma debe ser ordenada

📌 **Recomendación final:**
Seguir el **orden de migración en 5 fases** para minimizar riesgo y permitir testing gradual.
