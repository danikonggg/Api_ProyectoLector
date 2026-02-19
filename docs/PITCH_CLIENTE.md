# PROYECTO LECTOR
## Solución de gestión educativa y biblioteca digital

---

### Resumen ejecutivo

**Proyecto Lector** es una plataforma empresarial que unifica la administración de instituciones educativas, la distribución controlada de material didáctico digital y la trazabilidad de accesos bajo un modelo de gobernanza por roles. Diseñada para organizaciones que requieren control, auditoría y escalabilidad en la gestión escolar.

---

### Propuesta de valor

| Beneficio | Descripción |
|-----------|-------------|
| **Gobierno de la información** | Acceso segmentado por rol (Administrador, Director, Maestro, Alumno, Padre). Cada usuario opera únicamente sobre los datos de su competencia. |
| **Control de inventario digital** | Doble verificación en la asignación de libros: otorgamiento por administración central y canje por el director de cada escuela. Evita asignaciones indebidas. |
| **Cumplimiento y auditoría** | Registro de acciones críticas (inicios de sesión, registros, cambios en escuelas y libros). Base para auditorías internas y externas. |
| **Escalabilidad operativa** | Arquitectura preparada para crecimiento en instituciones y usuarios sin degradación del servicio. |
| **Integración** | API REST documentada para integración con portales web, apps móviles o sistemas existentes. |

---

### Modelo de gobernanza

```
ADMINISTRADOR (corporativo)
    │
    ├── Gestión de escuelas
    ├── Registro de directores
    ├── Catálogo y asignación de libros
    └── Auditoría global
         │
         ▼
DIRECTOR (por institución)
    │
    ├── Alumnos y maestros de su escuela
    ├── Canje de libros otorgados
    └── Reportes de su centro
         │
         ▼
MAESTRO ─── Alumnos asignados a sus materias
ALUMNO ─── Libros disponibles en su escuela
PADRE ─── Vinculación con sus hijos (alumnos)
```

---

### Flujo operativo: asignación de libros

1. **Administración central** carga el material y otorga un código a la escuela.
2. **Director de la escuela** canjea el código → el libro queda activo en su centro.
3. **Alumnos** acceden únicamente a los libros activos de su institución.

*Sin canje, el material no está disponible. Doble control para reducir riesgos operativos.*

---

### Stack tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | Next.js |
| **Backend** | API REST (NestJS) |
| **Base de datos** | PostgreSQL |
| **Autenticación** | JWT |

### Infraestructura y estándares

- Base de datos relacional PostgreSQL con modelo normalizado.
- Autenticación segura (JWT) y encriptación de credenciales.
- Limitación de tasa y protección frente a abusos.
- Documentación API disponible para equipos de desarrollo.
- Preparado para despliegue en producción (HTTPS, CORS, variables de entorno).

---

### Alcance para la organización

- **Control centralizado** de múltiples escuelas y usuarios.
- **Trazabilidad** de accesos y operaciones sensibles.
- **Segregación de funciones** y menor exposición a errores humanos.
- **Base tecnológica** para futuras ampliaciones (reportes, analytics, integraciones).

---

*Documento confidencial · Proyecto Lector · Febrero 2025*


