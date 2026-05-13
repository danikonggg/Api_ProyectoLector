# 📊 Diagramas de Dependencias - ApiLector Módulos

## Diagrama 1: Flujo de Dependencias Completo

```mermaid
graph TD
    subgraph "Capa de Infraestructura"
        Prisma["🔌 PrismaModule"]
        Redis["🔌 RedisModule"]
        Queue["🔌 QueuesModule"]
        Config["🔌 ConfigModule"]
    end

    subgraph "Capa 1: Sin Dependencias"
        Groq["✅ Groq<br/>1 service, 0 entities"]
        Materias["✅ Materias<br/>1 service, 1 entity"]
        Audit["✅ Audit<br/>1 service, 1 entity<br/>(GLOBAL)"]
        Alumno["✅ Alumno<br/>2 services, 2 entities"]
        Profesor["✅ Profesor<br/>1 service, 0 entities"]
    end

    subgraph "Capa 2: Base de Datos"
        Personas["🟡 Personas<br/>5 services, 10 entities<br/>(BASE)"]
        Auth["🟡 Auth<br/>1 service, múltiples guards"]
    end

    subgraph "Capa 3: Procesamiento"
        Licencias["🟡 Licencias<br/>2 services, 2 entities"]
        LibrosCore["🔥 LibrosCoreModule<br/>7 services, 6 entities"]
        Libros["🔥 Libros<br/>1 service"]
    end

    subgraph "Capa 4: Hub Central"
        Escuelas["🔥🔥 Escuelas<br/>6 services, 7 entities<br/>(HUB CRÍTICO)"]
    end

    subgraph "Capa 5: Aplicaciones"
        Maestros["🟡 Maestros<br/>1 service"]
        Admin["🟡 Admin<br/>1 service"]
        Director["🟡 Director<br/>1 service"]
    end

    %% Infraestructura
    Groq --> Prisma
    Materias --> Prisma
    Audit --> Prisma
    Alumno --> Prisma
    Profesor --> Prisma
    Personas --> Prisma
    Auth --> Prisma
    Licencias --> Prisma
    LibrosCore --> Prisma
    Libros --> Prisma
    Escuelas --> Prisma

    %% Dependencias entre módulos
    Auth -->|importa| Personas
    LibrosCore -->|importa| Groq
    Libros -->|importa| LibrosCore
    Libros -->|importa| Escuelas
    Escuelas -->|importa| Personas
    Escuelas -->|importa| Licencias
    Escuelas -->|importa| LibrosCore
    Maestros -->|importa| Escuelas
    Admin -->|importa| Personas
    Admin -->|importa| Escuelas
    Director -->|importa| Personas
    Director -->|importa| Escuelas

    %% Estilos
    classDef simple fill:#90EE90,stroke:#2d5016,stroke-width:2px
    classDef medio fill:#FFD700,stroke:#8B7500,stroke-width:2px
    classDef complejo fill:#FF6B6B,stroke:#8B0000,stroke-width:2px
    classDef critico fill:#FF1493,stroke:#8B008B,stroke-width:3px
    classDef infra fill:#87CEEB,stroke:#00008B,stroke-width:2px

    class Groq,Materias,Audit,Alumno,Profesor simple
    class Licencias,Maestros,Admin,Director medio
    class Personas,Auth,LibrosCore,Libros complejo
    class Escuelas critico
    class Prisma,Redis,Queue,Config infra
```

---

## Diagrama 2: Árbol de Dependencias (Escuelas como centro)

```mermaid
graph BT
    Escuelas["🔥🔥 ESCUELAS (HUB)"]
    
    Personas["🔥 Personas"]
    Licencias["🟡 Licencias"]
    LibrosCore["🔥 LibrosCoreModule"]
    
    Libros["🔥 Libros"]
    Maestros["🟡 Maestros"]
    Admin["🟡 Admin"]
    Director["🟡 Director"]
    
    Groq["✅ Groq"]
    
    Auth["🟡 Auth"]
    
    %% Dependencias hacia Escuelas
    Maestros -->|depende| Escuelas
    Admin -->|depende| Escuelas
    Director -->|depende| Escuelas
    Libros -->|depende| Escuelas
    
    %% Dependencias internas
    Escuelas -->|importa| Personas
    Escuelas -->|importa| Licencias
    Escuelas -->|importa| LibrosCore
    
    Auth -->|importa| Personas
    LibrosCore -->|importa| Groq
    Libros -->|importa| LibrosCore
    
    %% Estilos
    classDef simple fill:#90EE90,stroke:#2d5016,stroke-width:2px
    classDef medio fill:#FFD700,stroke:#8B7500,stroke-width:2px
    classDef complejo fill:#FF6B6B,stroke:#8B0000,stroke-width:2px
    classDef critico fill:#FF1493,stroke:#8B008B,stroke-width:3px

    class Groq,Audit,Alumno,Profesor simple
    class Licencias,Maestros,Admin,Director medio
    class Personas,Auth,LibrosCore,Libros complejo
    class Escuelas critico
```

---

## Diagrama 3: Orden de Migración Recomendado

```mermaid
graph LR
    subgraph Fase1["⏱️ Fase 1: Fundación<br/>(1-2 días)"]
        A1["1. Groq"]
        A2["2. Materias"]
        A3["3. Audit"]
        A4["4. Alumno"]
        A5["5. Profesor"]
    end

    subgraph Fase2["⏱️ Fase 2: Base<br/>(2-3 días)"]
        B1["6. Personas"]
        B2["7. Auth"]
    end

    subgraph Fase3["⏱️ Fase 3: Libros<br/>(3-5 días)"]
        C1["8. Licencias"]
        C2["9. LibrosCoreModule"]
        C3["10. Libros"]
    end

    subgraph Fase4["⏱️ Fase 4: Hub<br/>(3-4 días)"]
        D1["11. Escuelas"]
    end

    subgraph Fase5["⏱️ Fase 5: Apps<br/>(2-3 días)"]
        E1["12. Maestros"]
        E2["13. Admin"]
        E3["14. Director"]
    end

    Fase1 --> Fase2
    Fase2 --> Fase3
    Fase3 --> Fase4
    Fase4 --> Fase5

    classDef f1 fill:#90EE90,stroke:#2d5016,stroke-width:2px
    classDef f2 fill:#FFD700,stroke:#8B7500,stroke-width:2px
    classDef f3 fill:#FF6B6B,stroke:#8B0000,stroke-width:2px
    classDef f4 fill:#FF1493,stroke:#8B008B,stroke-width:3px
    classDef f5 fill:#87CEEB,stroke:#00008B,stroke-width:2px

    class Fase1,A1,A2,A3,A4,A5 f1
    class Fase2,B1,B2 f2
    class Fase3,C1,C2,C3 f3
    class Fase4,D1 f4
    class Fase5,E1,E2,E3 f5
```

---

## Diagrama 4: Matriz de Complejidad

```mermaid
graph TD
    subgraph L0["⭐ TRIVIAL (0 services)"]
        G["Groq"]
    end
    
    subgraph L1["⭐ SIMPLE (1 service)"]
        M["Materias"]
        AU["Audit"]
        PR["Profesor"]
    end
    
    subgraph L2["⭐⭐ SIMPLE-MEDIO (2 services)"]
        AL["Alumno"]
        LI["Licencias"]
    end
    
    subgraph L3["🟡 MEDIO (3+ services, deps claras)"]
        MA["Maestros"]
        AD["Admin"]
        DI["Director"]
    end
    
    subgraph L4["🔥 COMPLEJO (5+ services O 6+ entities)"]
        PE["Personas<br/>(10 entities)"]
        AU2["Auth<br/>(guards)"]
        LC["LibrosCoreModule<br/>(7 services)"]
        LB["Libros"]
    end
    
    subgraph L5["🔥🔥 EXTREMO (hub central)"]
        ES["Escuelas<br/>(7 entities, 6 services)<br/>Depende de: Personas,<br/>Licencias, LibrosCoreModule"]
    end

    classDef trivial fill:#90EE90,stroke:#2d5016,stroke-width:1px
    classDef simple fill:#98FB98,stroke:#2d5016,stroke-width:1px
    classDef simplemedium fill:#FFD700,stroke:#8B7500,stroke-width:1px
    classDef medium fill:#FFB347,stroke:#8B7500,stroke-width:1px
    classDef complex fill:#FF6B6B,stroke:#8B0000,stroke-width:2px
    classDef extreme fill:#FF1493,stroke:#8B008B,stroke-width:3px

    class G trivial
    class M,AU,PR simple
    class AL,LI simplemedium
    class MA,AD,DI medium
    class PE,AU2,LC,LB complex
    class ES extreme
```

---

## Diagrama 5: Ciclo de Vida de Entidades

```mermaid
graph LR
    subgraph Personas["👥 PERSONAS (Base)"]
        Per["Persona"]
        Adm["Administrador"]
        Pad["Padre"]
        Alu["Alumno"]
        Mae["Maestro"]
        Dir["Director"]
        Esc["Escuela"]
        Mat["Materia"]
        AM["AlumnoMaestro"]
        AVP["AlumnoVinculacionPadre"]
    end

    subgraph Escuelas["🏫 ESCUELAS (Gestión)"]
        EL["EscuelaLibro"]
        AL["AlumnoLibro"]
        Gru["Grupo"]
        MG["MaestroGrupo"]
        Ann["Anotacion"]
        ASE["AlumnoSegmentoEvaluacion"]
        ELP["EscuelaLibroPendiente"]
    end

    subgraph Libros["📚 LIBROS (Contenido)"]
        Lib["Libro"]
        Uni["Unidad"]
        Seg["Segmento"]
        PS["PreguntaSegmento"]
        Glo["Glosario"]
        SG["SeccionGlosario"]
    end

    subgraph Licencias["🔑 LICENCIAS"]
        LiL["LicenciaLibro"]
        LiA["LicenciaLibroArchivada"]
    end

    subgraph Alumno_M["📊 ALUMNO (Seguimiento)"]
        PA["PreferenciasAlumno"]
        SL["SesionLectura"]
    end

    subgraph Audit_M["📋 AUDIT"]
        AuL["AuditLog"]
    end

    Alu -->|asignado a| Lib
    Alu -->|pertenece a| Gru
    Mae -->|enseña en| Gru
    Per -->|base de| Alu
    Per -->|base de| Mae
    Per -->|base de| Dir

    classDef personas fill:#FFB6C1,stroke:#8B0000,stroke-width:2px
    classDef escuelas fill:#B0E0E6,stroke:#00008B,stroke-width:2px
    classDef libros fill:#F0E68C,stroke:#8B7500,stroke-width:2px
    classDef licencias fill:#DDA0DD,stroke:#8B008B,stroke-width:2px
    classDef alumno fill:#90EE90,stroke:#2d5016,stroke-width:2px
    classDef audit fill:#D3D3D3,stroke:#404040,stroke-width:2px

    class Per,Adm,Pad,Alu,Mae,Dir,Esc,Mat,AM,AVP personas
    class EL,AL,Gru,MG,Ann,ASE,ELP escuelas
    class Lib,Uni,Seg,PS,Glo,SG libros
    class LiL,LiA licencias
    class PA,SL alumno
    class AuL audit
```

---

## Tabla Comparativa: Esfuerzo de Migración

| Módulo | Servicios | Entidades | Deps | Complejidad | Duración | Riesgo |
|--------|-----------|-----------|------|-------------|----------|--------|
| Groq | 1 | 0 | 0 | ⭐ | 2h | Muy bajo |
| Materias | 1 | 1 | 0 | ⭐ | 2h | Muy bajo |
| Audit | 1 | 1 | 0 | ⭐ | 2h | Muy bajo |
| Alumno | 2 | 2 | 0 | ⭐ | 3h | Muy bajo |
| Profesor | 1 | 0 | 0 | ⭐ | 2h | Muy bajo |
| Licencias | 2 | 2 | 0 | 🟡 | 4h | Bajo |
| Maestros | 1 | 0 | 1 | 🟡 | 3h | Bajo |
| Admin | 1 | 0 | 2 | 🟡 | 4h | Medio |
| Director | 1 | 0 | 2 | 🟡 | 4h | Medio |
| **Personas** | **5** | **10** | **1** | **🔥** | **8h** | **Medio** |
| **Auth** | **2** | **2** | **1** | **🔥** | **6h** | **Medio** |
| **LibrosCoreModule** | **7** | **6** | **1** | **🔥** | **12h** | **Alto** |
| **Libros** | **1** | **0** | **2** | **🔥** | **6h** | **Alto** |
| **Escuelas** | **6** | **7** | **3** | **🔥🔥** | **12h** | **Alto** |

---

## Checklist de Migración por Módulo

### ✅ Groq
- [ ] Convertir service de TypeORM a Prisma
- [ ] Actualizar inyecciones de dependencia
- [ ] Tests unitarios

### ✅ Materias
- [ ] Migrar TypeORM a Prisma
- [ ] Actualizar CRUD operations
- [ ] Tests

### ✅ Audit
- [ ] Migrar TypeOrmModule a Prisma
- [ ] Actualizar AuditService
- [ ] Verificar interceptor HTTP
- [ ] Tests

### ✅ Alumno
- [ ] Migrar 2 entities (PreferenciasAlumno, SesionLectura)
- [ ] Actualizar 2 servicios
- [ ] Validar controllers

### ✅ Profesor
- [ ] Migrar service
- [ ] Actualizar queries de lectura (no escriben)

### 🟡 Licencias
- [ ] Migrar 2 entities
- [ ] Actualizar 2 servicios
- [ ] Validar relaciones con Escuelas

### 🟡 Maestros
- [ ] Migrar service
- [ ] Validar dependencia con EscuelasModule

### 🟡 Admin
- [ ] Migrar service
- [ ] Validar dependencias (Personas + Escuelas)

### 🟡 Director
- [ ] Migrar service
- [ ] Validar dependencias (Personas + Escuelas)

### 🔥 Personas
- [ ] Migrar 10 entities (incluyendo herencia)
- [ ] Migrar 5 servicios
- [ ] Validar relaciones complejas
- [ ] Tests integrales
- [ ] Validar AuthModule

### 🔥 Auth
- [ ] Migrar Auth service
- [ ] Mantener JwtStrategy y guards
- [ ] Validar dependencia de Personas

### 🔥 LibrosCoreModule
- [ ] Migrar 7 servicios
- [ ] Migrar 6 entities
- [ ] Preservar lógica de procesamiento de PDFs
- [ ] Validar integración con Groq
- [ ] Tests de procesamiento

### 🔥 Libros
- [ ] Migrar HTTP service
- [ ] Validar libros.controller
- [ ] Validar dependencias (Escuelas + LibrosCoreModule)

### 🔥🔥 Escuelas (CRÍTICO)
- [ ] Migrar 7 entities
- [ ] Migrar 6 servicios
- [ ] Validar 3 controllers
- [ ] Validar dependencias (Personas, Licencias, LibrosCoreModule)
- [ ] Validar uso desde: Libros, Maestros, Admin, Director
- [ ] Tests integrales (100% coverage para relaciones)
- [ ] Smoke tests de todo el sistema

---

## Notas de Implementación

### Orden estricto recomendado:
```
Fase 1: Groq → Materias → Audit → Alumno → Profesor
    ↓
Fase 2: Personas → Auth
    ↓
Fase 3: Licencias → LibrosCoreModule → Libros
    ↓
Fase 4: Escuelas (PUNTO CRÍTICO)
    ↓
Fase 5: Maestros → Admin → Director
```

### Validaciones necesarias en cada fase:
1. ✅ TypeScript compilation limpia
2. ✅ Tests unitarios pasan (del módulo)
3. ✅ No hay imports rotos
4. ✅ Database schema matches
5. ✅ Runtime: servicio inicia sin errores

### Rollback plan:
- Mantener TypeORM comentado en package.json
- Crear branch por módulo
- Validar en test environment antes de production
