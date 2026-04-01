# Sistema de Licencias por Libro (Implementado)

## Resumen

Sistema de **licencias individuales** para libros: cada licencia = 1 alumno. El admin genera un lote de licencias para una escuela (ej. 50 licencias = 50 alumnos). Cada licencia tiene:
- **Clave única** (ej. `LECT-A1B2-C3D4-E5F6`)
- **Vencimiento** (fecha de expiración)
- **Asociada solo a esa escuela**
- **Un solo uso**: 1 alumno por licencia (una vez canjeada, no se puede reutilizar)

Se pueden exportar las licencias en **PDF** (o CSV/Excel) para entregar a la escuela.

---

## Flujo propuesto

### 1. Admin genera licencias

- El admin selecciona: **escuela**, **libro**, **cantidad** (ej. 50), **fecha de vencimiento**.
- El sistema genera N claves únicas y crea registros en `Licencia_Libro`.
- Las licencias quedan **disponibles** (sin alumno asignado).

### 2. Admin exporta licencias

- El admin puede generar un **PDF** (o CSV) con las claves para entregar a la escuela.
- El PDF incluye: escuela, libro, fecha vencimiento, lista de claves (o códigos QR si se desea más adelante).

### 3. Alumno (o director en nombre del alumno) canjea la licencia

- El alumno ingresa su **clave de licencia** en la app.
- El sistema valida:
  - La licencia existe.
  - Pertenece a la escuela del alumno.
  - No está vencida.
  - No ha sido usada (sin alumno asignado).
  - El alumno es del grado adecuado del libro (opcional).
- Si todo es correcto: se asocia la licencia al alumno y se crea `Alumno_Libro`.
- A partir de ahí, el alumno ve el libro en "Mis libros" como siempre.

---

## Modelo de datos

### Nueva tabla: `Licencia_Libro`

| Campo               | Tipo        | Descripción                                      |
|---------------------|-------------|--------------------------------------------------|
| id                  | bigint PK   | ID                                               |
| clave               | varchar(50) UNIQUE | Clave única (ej. LECT-A1B2-C3D4-E5F6)     |
| libro_id            | bigint FK   | Libro asociado                                   |
| escuela_id          | bigint FK   | Escuela (solo esa escuela puede usar la licencia)|
| alumno_id           | bigint FK nullable | Alumno que canjeó (null = disponible)     |
| fecha_vencimiento   | date        | Fecha de expiración                              |
| activa              | boolean     | Si está vigente (admin puede desactivar)         |
| fecha_asignacion    | timestamptz nullable | Cuándo el alumno canjeó la licencia       |
| created_at          | timestamptz | Fecha de creación                                |

**Índices:**
- UNIQUE en `clave`
- Índice en `(escuela_id, libro_id, activa)`
- Índice en `alumno_id`

**Reglas:**
- Una licencia con `alumno_id != null` está **usada** y no se puede reasignar.
- `fecha_vencimiento` se valida al canjear y al usar el libro.

---

## Endpoints propuestos

### Admin

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST   | `/licencias/generar` | Generar lote de licencias (escuelaId, libroId, cantidad, fechaVencimiento) |
| GET    | `/licencias` | Listar licencias (filtros: escuela, libro, estado) |
| GET    | `/licencias/escuela/:id` | Licencias de una escuela |
| GET    | `/licencias/exportar-pdf` | Exportar licencias a PDF (query: escuelaId, libroId, ids) |
| PATCH  | `/licencias/:id/activa` | Activar/desactivar licencia |

### Alumno / Director (para canjear en nombre del alumno)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST   | `/licencias/canjear` | Canjear licencia con clave (body: clave, alumnoId si es director) |
| GET    | `/licencias/validar/:clave` | Validar si una clave es usable (opcional, para pre-validar) |

### Director

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET    | `/director/licencias-disponibles` | Licencias disponibles de su escuela para asignar a alumnos |

---

## Generación de claves

Formato sugerido: `DDDD-DDDD-DDDD-DDDD` (4 grupos de 4 dígitos numéricos con guiones).

Ejemplo: `LECT-A3B7-K9M2-P4Q8`

- Clave: aleatoria numérica con verificación de unicidad.

---

## Exportación a PDF

El PDF contendría:

1. **Cabecera**: nombre de la escuela, libro, fecha de vencimiento.
2. **Instrucciones**: cómo canjear la licencia (ingresar clave en la app).
3. **Lista de licencias**: tabla con número, clave, estado (Disponible/Usada).
4. Opcional: códigos QR por licencia para escanear (fase futura).

Se usará **pdfkit** (o similar) en Node.js para generar el PDF.

---

## Relación con el flujo actual

El flujo actual (**Escuela_Libro** + **Escuela_Libro_Pendiente** + canje por código único) puede **coexistir**:

- **Modelo actual**: 1 código = libro disponible para toda la escuela; director/maestro asigna a alumnos.
- **Modelo licencias**: 1 licencia = 1 alumno; cada alumno canjea su propia clave.

Puedes decidir:
- **Opción A**: Usar ambos modelos (algunos libros por código, otros por licencias).
- **Opción B**: Migrar gradualmente a licencias y deprecar el modelo por código para ciertos libros.

La implementación propuesta permite ambos sin conflictos.

---

## Resumen de archivos a crear/modificar

### Backend (NestJS)

- `src/licencias/` (nuevo módulo)
  - `licencias.module.ts`
  - `licencias.controller.ts`
  - `licencias.service.ts`
  - `entities/licencia-libro.entity.ts`
  - `dto/crear-licencias.dto.ts`
  - `dto/canjear-licencia.dto.ts`
- `migrations/add_licencia_libro.sql`
- Instalar `pdfkit` y `@types/pdfkit` para generación de PDF

### Frontend (Admin)

- Nueva página: **AdminLicencias** o sección dentro de Libros/Escuelas.
- Formulario: generar licencias (escuela, libro, cantidad, vencimiento).
- Botón: exportar a PDF.
- Listado de licencias por escuela/libro con filtros.

---

---

## Implementación (Febrero 2025)

**Antes de usar:** Ejecutar la migración:
```bash
psql -U postgres -d api_lector -f migrations/add_licencia_libro.sql
```

- Migración: `migrations/add_licencia_libro.sql`
- Módulo: `src/licencias/` (LicenciasModule, LicenciasService, LicenciasController)
- Flujo anterior (otorgar/canjear por código) **eliminado**. La asignación ahora es solo por licencias.
