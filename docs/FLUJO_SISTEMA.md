# 📊 Flujo del sistema – API Lector

Análisis completo de fases, permisos y flujos del sistema educativo.

---

## Índice

1. [Resumen ejecutivo](#-resumen-ejecutivo)
2. [Fase 1: Inicialización](#fase-1-inicialización-sin-autenticación)
3. [Fase 2: Autenticación](#fase-2-autenticación)
4. [Fase 3: Gestión de escuelas](#fase-3-gestión-de-escuelas-solo-administradores)
5. [Fase 4: Gestión de directores](#fase-4-gestión-de-directores-solo-administradores)
6. [Fase 5: Registro de alumnos](#fase-5-registro-de-alumnos-admin-o-director)
7. [Fase 6: Registro de maestros](#fase-6-registro-de-maestros-admin-o-director)
8. [Fase 7: Padres y alumnos (consultas)](#fase-7-registro-de-padres-y-alumnos-padrealumno)
9. [Fase 8: Acceso de alumnos a libros](#fase-8-acceso-de-alumnos-a-libros)
10. [Fase 9: Consultas admin](#fase-9-consultas-solo-administradores)
11. [Guards y permisos](#-sistema-de-seguridad-y-permisos)
12. [Matriz de permisos](#-matriz-de-permisos)
13. [Flujos típicos](#-flujo-típico-de-uso)
14. [Modelo de datos](#-modelo-de-datos)
15. [Documentación relacionada](#-documentación-relacionada)

---

## 🎯 Resumen ejecutivo

Sistema educativo con roles jerárquicos:

| Rol | Alcance |
|-----|---------|
| **Administrador** | Todo el sistema: escuelas, directores, padres, libros, auditoría. Máx. 5 admins. |
| **Director** | Solo su escuela: alumnos, maestros, canjear libros. |
| **Maestro** | Alumnos asignados a su clase (por materia), misma escuela. |
| **Alumno** | Libros asignados a su escuela (lectura y descarga). |
| **Padre** | Vinculado a sus hijos (alumnos). |

---

## 🔄 FLUJO COMPLETO DEL SISTEMA

### **FASE 1: INICIALIZACIÓN** (Sin autenticación)

#### 1.1 Registro de Administradores
```
POST /auth/registro-admin
```
- **Permisos**: Público (sin autenticación) o con JWT de admin (hasta completar 5)
- **Límite**: Máximo 5 administradores en el sistema
- **Validación**: 
  - Email único
  - Contraseña mínimo 6 caracteres
  - Verifica que no se excedan 5 admins
- **Resultado**: Crea Persona + Administrador, genera password hasheado

**Flujo:**
```
Cliente → POST /auth/registro-admin
  ↓
AuthService.registrarAdmin()
  ↓
Verifica cantidad de admins (< 3)
  ↓
Crea Persona (tipoPersona: 'administrador')
  ↓
Crea Administrador (relacionado con Persona)
  ↓
Retorna datos del admin creado
```

#### 1.2 Verificar Cantidad de Admins
```
GET /personas/admins/cantidad
```
- **Permisos**: Público
- **Propósito**: Verificar cuántos admins se pueden registrar aún

---

### **FASE 2: AUTENTICACIÓN**

#### 2.1 Login (Cualquier Usuario)
```
POST /auth/login
```
- **Permisos**: Público
- **Input**: `{ email, password }`
- **Proceso**:
  1. Busca Persona por email
  2. Verifica password con bcrypt
  3. Verifica que usuario esté activo
  4. Carga relaciones (administrador, director, alumno, maestro, padre)
  5. Genera token JWT con payload: `{ sub: personaId, email, tipoPersona }`
- **Output**: Token JWT + datos del usuario

**Flujo:**
```
Cliente → POST /auth/login { email, password }
  ↓
AuthService.login()
  ↓
Busca Persona por email (con relaciones)
  ↓
Verifica password (bcrypt.compare)
  ↓
Verifica activo === true
  ↓
Genera JWT token
  ↓
Retorna { access_token, user, token_type, expires_in }
```

#### 2.2 Obtener Perfil
```
GET /auth/profile
```
- **Permisos**: Requiere JWT válido
- **Propósito**: Obtener información del usuario autenticado

---

### **FASE 3: GESTIÓN DE ESCUELAS** (Solo Administradores)

#### 3.1 Crear Escuela
```
POST /escuelas
Authorization: Bearer <token_admin>
```
- **Permisos**: AdminGuard (solo administradores)
- **Validaciones**:
  - Nombre único
  - Clave única (si se proporciona)
- **Campos**: nombre, nivel, clave, direccion, telefono

**Flujo:**
```
Admin → POST /escuelas (con token)
  ↓
JwtAuthGuard valida token
  ↓
AdminGuard verifica tipoPersona === 'administrador'
  ↓
EscuelasService.crear()
  ↓
Verifica nombre/clave únicos
  ↓
Crea Escuela
  ↓
Retorna escuela creada
```

#### 3.2 Listar Escuelas
```
GET /escuelas
Authorization: Bearer <token_admin>
```
- **Permisos**: AdminGuard
- **Orden**: Por nombre (ASC)

#### 3.3 Obtener Escuela por ID
```
GET /escuelas/:id
Authorization: Bearer <token_admin>
```
- **Permisos**: AdminGuard
- **Incluye**: alumnos y maestros relacionados

#### 3.4 Actualizar Escuela
```
PUT /escuelas/:id
Authorization: Bearer <token_admin>
```
- **Permisos**: AdminGuard
- **Validaciones**: Nombre/clave únicos (si se cambian)

#### 3.5 Eliminar Escuela
```
DELETE /escuelas/:id
Authorization: Bearer <token_admin>
```
- **Permisos**: AdminGuard
- **Restricción**: No se puede eliminar si tiene alumnos o maestros

#### 3.6 Libros – Doble verificación
```
POST /escuelas/:id/libros
Authorization: Bearer <token_admin>
Body: { "codigo": "LIB-..." }
```
- **Permisos**: AdminGuard
- **Propósito**: Asignar un libro a una escuela por su **código** (como “vender” el libro a la escuela). La escuela solo ve los libros que tiene asignados.
- **Validaciones**: Escuela existe, libro existe por código, el libro no está ya asignado a esa escuela (único por escuela+libro).

**Resumen:** Paso 1: Admin otorga (`POST /escuelas/:id/libros`). Paso 2: Director canjea (`POST /escuelas/:id/libros/canjear`). Ver [FLUJO_LIBROS_DOBLE_VERIFICACION.md](./FLUJO_LIBROS_DOBLE_VERIFICACION.md).

#### 3.7 Listar libros activos de la escuela
```
GET /escuelas/:id/libros
Authorization: Bearer <token_admin_o_director>
```
- **Permisos**: AdminOrDirectorGuard
- **Admin**: Puede listar libros de cualquier escuela.
- **Director**: Solo puede listar libros de **su** escuela (`id` debe coincidir con `director.escuelaId`). Si pide otra escuela → 403 Forbidden.
- **Retorna**: Solo libros **ya canjeados** (activos). No incluye pendientes.

---

### **FASE 4: GESTIÓN DE DIRECTORES** (Solo Administradores)

#### 4.1 Registrar Director
```
POST /personas/registro-director
Authorization: Bearer <token_admin>
Body: { ...datos, idEscuela }
```
- **Permisos**: AdminGuard
- **Validaciones**:
  - Email único
  - Escuela existe
  - Escuela tiene menos de 3 directores (máx. 3 directores por escuela)
- **Resultado**: Crea Persona + Director, asocia a Escuela

**Flujo:**
```
Admin → POST /personas/registro-director
  ↓
JwtAuthGuard + AdminGuard
  ↓
PersonasService.registrarDirector()
  ↓
Verifica email único
  ↓
Verifica escuela existe
  ↓
Verifica escuela tiene menos de 3 directores
  ↓
Crea Persona (tipoPersona: 'director')
  ↓
Crea Director (relacionado con Persona y Escuela)
  ↓
Retorna director creado
```

---

### **FASE 5: REGISTRO DE ALUMNOS** (Admin o Director)

#### 5.1 Registrar Alumno
```
POST /personas/registro-alumno
Authorization: Bearer <token_admin_o_director>
Body: { ...datos [, idEscuela] }
```
- **Permisos**: AdminOrDirectorGuard
- **Campo `idEscuela`**:
  - **Admin**: Obligatorio. Debe indicar la escuela donde se registra el alumno.
  - **Director**: Opcional. Si no lo envía, se usa automáticamente la escuela del director (ya está asociado a una escuela). Si lo envía, debe ser su propia escuela.
- **Validaciones**:
  - Email único
  - Escuela existe
  - **Si es Director**: Solo puede registrar en SU escuela (o no enviar idEscuela y se asigna la suya)
  - **Si es Admin**: Debe enviar idEscuela; puede registrar en cualquier escuela

**Flujo:**
```
Admin/Director → POST /personas/registro-alumno
  ↓
JwtAuthGuard valida token
  ↓
AdminOrDirectorGuard verifica (admin OR director)
  ↓
Si es Director:
  - Si no envió idEscuela → se asigna director.escuelaId al DTO
  - Si envió idEscuela → se valida que sea su escuela (comparación numérica)
  - Si idEscuela ≠ su escuela → 403 Forbidden
Si es Admin:
  - Si no envió idEscuela → 400 Bad Request ("Debe indicar el ID de la escuela")
  ↓
PersonasService.registrarAlumno()
  ↓
Verifica email único
  ↓
Verifica escuela existe
  ↓
Crea Persona (tipoPersona: 'alumno')
  ↓
Crea Alumno (relacionado con Persona y Escuela)
  ↓
Retorna alumno creado
```

**Validación para Directores (idEscuela opcional, comparación por valor numérico):**
```typescript
if (user.tipoPersona === 'director' && user.director) {
  const miEscuelaId = Number(user.director.escuelaId ?? user.director.escuela?.id);
  if (registroDto.idEscuela == null || registroDto.idEscuela === undefined) {
    registroDto.idEscuela = miEscuelaId;  // Director no envía escuela → se usa la suya
  } else if (Number(registroDto.idEscuela) !== miEscuelaId) {
    throw ForbiddenException('Los directores solo pueden registrar alumnos en su propia escuela');
  }
}
```

---

### **FASE 6: REGISTRO DE MAESTROS** (Admin o Director)

#### 6.1 Registrar Maestro
```
POST /personas/registro-maestro
Authorization: Bearer <token_admin_o_director>
Body: { ...datos [, idEscuela] }
```
- **Permisos**: AdminOrDirectorGuard
- **Campo `idEscuela`**:
  - **Admin**: Obligatorio. Debe indicar la escuela.
  - **Director**: Opcional. Si no lo envía, se usa automáticamente su escuela.
- **Validaciones**: Igual que alumnos. Director solo en SU escuela.

**Flujo:** Idéntico al de alumnos, pero crea Maestro en lugar de Alumno

---

### **FASE 7: REGISTRO DE PADRES Y ALUMNOS** (Padre–Alumno)

**📋 Flujo completo:** Ver [FLUJO_PADRE_ALUMNO.md](./FLUJO_PADRE_ALUMNO.md).

#### 7.1 Registrar Padre
```
POST /personas/registro-padre
Authorization: Bearer <token_admin>
Body: { ...datos }
```
- **Permisos**: AdminGuard
- **Validaciones**: Email único

#### 7.2 Registrar Padre e Hijo juntos
```
POST /personas/registro-padre-con-hijo
Authorization: Bearer <token_admin>
Body: { padre: {...}, hijo: {...} }
```
- Crea padre e hijo en una operación y los vincula.

#### 7.3 Registrar Alumno (con opciones de padre)
```
POST /personas/registro-alumno
Body: { ...datos, padreId?: number, crearPadreAutomatico?: boolean }
```
- **padreId**: vincula a un padre existente.
- **crearPadreAutomatico**: crea padre con datos temporales (@temp.local); completar después con `PUT /personas/padres/:id`.

#### 7.4 Actualizar datos del padre
```
PUT /personas/padres/:id
Body: { nombre?, apellido?, email?, password?, telefono? }
```
- Para completar padres creados con `crearPadreAutomatico`.

#### 7.5 Consultas (GET)
- `GET /personas/alumnos` – Listar alumnos (Admin/Director). Incluye padre. Query: `escuelaId`, `page`, `limit`.
- `GET /personas/alumnos/buscar` – Búsqueda global por un campo. Solo query: `campo` y `valor` (sin paginación ni filtro por escuela; director sigue restringido a su escuela).
- `GET /personas/alumnos/:id` – Alumno por ID.
- `GET /personas/alumnos/:id/padre` – Padre del alumno.
- `GET /personas/padres` – Listar padres (Admin). Incluye `pendiente` para temporales.
- `GET /personas/padres/:id` – Padre por ID.
- `GET /personas/padres/:id/alumnos` – Hijos del padre.

---

### **FASE 8: ACCESO DE ALUMNOS A LIBROS**

#### 8.1 Mis libros (biblioteca digital)
```
GET /escuelas/mis-libros
Authorization: Bearer <token_alumno>
```
- **Permisos**: AlumnoGuard (solo alumnos)
- **Propósito**: Listar libros asignados a la escuela del alumno
- **Retorna**: Lista de libros con id, titulo, grado, descripcion, codigo

#### 8.2 Ver libro y descargar PDF
```
GET /libros/:id
GET /libros/:id/pdf
Authorization: Bearer <token_alumno>
```
- **Permisos**: AdminOrDirectorOrAlumnoGuard
- **Alumno**: Solo si el libro está asignado a su escuela. Si no → 403.

---

### **FASE 9: CONSULTAS** (Administradores y Director)

#### 9.1 Dashboard Admin
```
GET /admin/dashboard
Authorization: Bearer <token_admin>
```
- **Permisos**: AdminGuard
- **Retorna**: Estadísticas globales (escuelas activas, estudiantes, profesores, libros disponibles)

#### 9.2 Dashboard Director
```
GET /director/dashboard
Authorization: Bearer <token_admin_director>
```
- **Permisos**: DirectorGuard
- **Retorna**: Datos de su escuela, total estudiantes, profesores, libros disponibles

#### 9.3 Listar Administradores
```
GET /personas/admins
Authorization: Bearer <token_admin>
```
- **Permisos**: AdminGuard
- **Retorna**: Lista de todos los administradores

#### 9.4 Auditoría (solo Admin)
```
GET /audit
Authorization: Bearer <token_admin>
Query: ?page=1&limit=20
```
- **Permisos**: AdminGuard
- **Retorna**: Logs de acciones (login, registros, escuelas, libros)

---

## 🔐 SISTEMA DE SEGURIDAD Y PERMISOS

### Guards Implementados

#### 1. JwtAuthGuard
- **Propósito**: Verifica que el token JWT sea válido
- **Proceso**:
  1. Extrae token del header `Authorization: Bearer <token>`
  2. Valida firma y expiración
  3. Busca Persona en BD con relaciones
  4. Agrega `user` al request

#### 2. AdminGuard
- **Propósito**: Solo permite administradores
- **Validación**: 
  ```typescript
  user.tipoPersona === 'administrador' && user.administrador !== null
  ```
- **Uso**: Endpoints de gestión global (escuelas, directores)

#### 3. DirectorGuard
- **Propósito**: Solo permite directores
- **Validación**: 
  ```typescript
  user.tipoPersona === 'director' && user.director !== null
  ```

#### 4. AdminOrDirectorGuard
- **Propósito**: Permite admin O director
- **Validación**: 
  ```typescript
  (esAdmin || esDirector)
  ```
- **Uso**: Registro de alumnos y maestros

#### 5. MaestroGuard
- **Propósito**: Solo permite maestros
- **Validación**: 
  ```typescript
  user.tipoPersona === 'maestro' && user.maestro !== null
  ```
- **Uso**: Gestión de alumnos (listar, ver, asignar, desasignar)

#### 6. AlumnoGuard
- **Propósito**: Solo permite alumnos
- **Validación**: 
  ```typescript
  user.tipoPersona === 'alumno' && user.alumno !== null
  ```
- **Uso**: `GET /escuelas/mis-libros` (biblioteca digital)

#### 7. AdminOrDirectorOrAlumnoGuard
- **Propósito**: Permite admin O director O alumno
- **Uso**: `GET /libros/:id` y `GET /libros/:id/pdf` (alumno solo libros de su escuela; validación adicional en el controlador)

---

## 📋 MATRIZ DE PERMISOS

| Endpoint | Público | Admin | Director | Maestro | Alumno | Padre |
|----------|--------|-------|----------|---------|--------|-------|
| `POST /auth/login` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /auth/registro-admin` | ✅ | ✅* | - | - | - | - |
| `GET /auth/profile` | - | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /admin/dashboard` | - | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GET /director/dashboard` | - | ❌ | ✅ | ❌ | ❌ | ❌ |
| `GET /audit` | - | ✅ | ❌ | ❌ | ❌ | ❌ |
| `POST /escuelas` | - | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GET /escuelas` | - | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GET /escuelas/:id` | - | ✅ | ❌ | ❌ | ❌ | ❌ |
| `PUT /escuelas/:id` | - | ✅ | ❌ | ❌ | ❌ | ❌ |
| `DELETE /escuelas/:id` | - | ✅ | ❌ | ❌ | ❌ | ❌ |
| `POST /personas/registro-director` | - | ✅ | ❌ | ❌ | ❌ | ❌ |
| `POST /personas/registro-alumno` | - | ✅ | ✅* | ❌ | ❌ | ❌ |
| `POST /personas/registro-maestro` | - | ✅ | ✅* | ❌ | ❌ | ❌ |
| `POST /personas/registro-padre` | - | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GET /personas/admins` | - | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GET /personas/alumnos` | - | ✅ | ✅* | ❌ | ❌ | ❌ |
| `GET /personas/alumnos/buscar` | - | ✅ | ✅* | ❌ | ❌ | ❌ |
| `GET /personas/alumnos/:id` | - | ✅ | ✅* | ❌ | ❌ | ❌ |
| `GET /maestros/mis-alumnos` | - | ❌ | ❌ | ✅ | ❌ | ❌ |
| `GET /maestros/mis-alumnos/:id` | - | ❌ | ❌ | ✅ | ❌ | ❌ |
| `POST /maestros/asignar-alumno` | - | ❌ | ❌ | ✅ | ❌ | ❌ |
| `DELETE /maestros/mis-alumnos/:alumnoId/materia/:materiaId` | - | ❌ | ❌ | ✅ | ❌ | ❌ |
| `GET /escuelas/mis-libros` (libros de mi escuela) | - | ❌ | ❌ | ❌ | ✅ | ❌ |
| `POST /libros/cargar` (multipart: PDF + metadatos) | - | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GET /libros` | - | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GET /libros/:id` | - | ✅ | ✅ | ❌ | ✅* | ❌ |
| `GET /libros/:id/pdf` | - | ✅ | ✅ | ❌ | ✅* | ❌ |
| `DELETE /libros/:id` | - | ✅ | ❌ | ❌ | ❌ | ❌ |
| `POST /escuelas/:id/libros` (otorgar libro – Paso 1) | - | ✅ | ❌ | ❌ | ❌ | ❌ |
| `POST /escuelas/:id/libros/canjear` (canjear – Paso 2) | - | ✅ | ✅* | ❌ | ❌ | ❌ |
| `GET /escuelas/:id/libros/pendientes` | - | ✅ | ✅* | ❌ | ❌ | ❌ |
| `GET /escuelas/:id/libros` (libros activos) | - | ✅ | ✅* | ❌ | ❌ | ❌ |

**Notas:** (1) Registro admin: público hasta completar 5; luego solo con token de admin. (2) Directores: solo su escuela (alumnos, maestros, libros, listados/búsqueda alumnos). (3) Alumnos: solo libros de su escuela. (4) Maestros: solo alumnos de su clase (Alumno_Maestro) y misma escuela.

---

## 🔄 FLUJO TÍPICO DE USO

### Escenario 1: Admin Configura Sistema

```
1. POST /auth/registro-admin (crear admin inicial)
   ↓
2. POST /auth/login (obtener token)
   ↓
3. POST /escuelas (crear escuela)
   ↓
4. POST /personas/registro-director (asignar director a escuela)
   ↓
5. POST /personas/registro-alumno (registrar alumnos)
   ↓
6. POST /personas/registro-maestro (registrar maestros)
   ↓
7. POST /libros/cargar (PDF + metadatos) → libro listo
   ↓
8. POST /escuelas/:id/libros { codigo } → Admin otorga libro (crea pendiente)
   ↓
9. POST /escuelas/:id/libros/canjear { codigo } → Director canjea (libro activo)
   ↓
10. GET /escuelas/:id/libros (ver libros activos de la escuela)
```

### Escenario 2: Director Gestiona Su Escuela

```
1. POST /auth/login (director se autentica)
   ↓
2. POST /personas/registro-alumno (sin idEscuela; se usa su escuela)
   ↓
3. POST /personas/registro-maestro (sin idEscuela; se usa su escuela)
   ↓
4. GET /escuelas/:id/libros/pendientes (ver libros pendientes de canjear; solo título y grado)
   ↓
5. POST /escuelas/:id/libros/canjear { codigo } (canjear con código que le dio el admin)
   ↓
6. GET /escuelas/:id/libros (ver libros activos)
```

**Restricciones**: Si el director intenta registrar en otra escuela → 403. Si pide o asigna libros de otra escuela → 403.  
**Nota**: El director **no tiene que enviar** `idEscuela` al registrar un alumno; el backend usa automáticamente su escuela.

### Escenario 3: Alumno Lee Libros de Su Escuela

```
1. POST /auth/login (alumno se autentica)
   ↓
2. GET /escuelas/mis-libros (listar libros asignados a su escuela)
   ↓
3. GET /libros/:id (ver contenido del libro: unidades y segmentos)
   ↓
4. GET /libros/:id/pdf (descargar PDF del libro)
```

**Restricciones**: El alumno solo puede acceder a libros asignados a su escuela. Si intenta acceder a un libro de otra escuela → 403.

### Escenario 4: Maestro Gestiona Sus Alumnos

```
1. POST /auth/login (maestro se autentica)
   ↓
2. GET /maestros/mis-alumnos (listar alumnos asignados a su clase)
   ↓
3. GET /maestros/mis-alumnos/:id (ver detalle de un alumno, solo si está en su clase)
   ↓
4. POST /maestros/asignar-alumno { alumnoId, materiaId } (asignar alumno a su clase)
   - El alumno debe ser de la misma escuela que el maestro
   ↓
5. DELETE /maestros/mis-alumnos/:alumnoId/materia/:materiaId (desasignar alumno)
```

**Restricciones**:
- Solo ve y gestiona alumnos asignados vía `Alumno_Maestro` (por materia).
- Solo puede asignar alumnos de su misma escuela.

---

## 🗄️ MODELO DE DATOS

### Relaciones Principales

```
Persona (1) ←→ (1) Administrador
Persona (1) ←→ (1) Director
Persona (1) ←→ (1) Maestro
Persona (1) ←→ (1) Alumno
Persona (1) ←→ (1) Padre

Escuela (1) ←→ (N) Director
Escuela (1) ←→ (N) Maestro
Escuela (1) ←→ (N) Alumno

Director (N) ←→ (1) Escuela
Maestro (N) ←→ (1) Escuela
Alumno (N) ←→ (1) Escuela
Alumno (N) ←→ (1) Padre (opcional; padre_id en Alumno)

Alumno_Maestro (asignación alumno–maestro por materia):
  alumno_id, maestro_id, materia_id, fecha_inicio, fecha_fin
Materia (materia/asignatura): id, nombre, descripcion, nivel

Escuela_Libro (asignación libro–escuela; “vender” libro a la escuela):
  escuela_id, libro_id, activo, fecha_inicio, fecha_fin
  - Unique (escuela_id, libro_id). La escuela solo ve libros asignados.
```

### Campos Clave

- **Persona.tipoPersona**: 'administrador' | 'director' | 'maestro' | 'alumno' | 'padre'
- **Persona.activo**: boolean (controla si puede hacer login)
- **Director.escuelaId**: ID de la escuela que gestiona
- **Alumno.escuelaId**: ID de la escuela donde estudia
- **Maestro.escuelaId**: ID de la escuela donde enseña

---

## ⚠️ VALIDACIONES IMPORTANTES

1. **Email único**: No puede haber dos personas con el mismo email
2. **Escuela existe**: Al registrar alumno/maestro, la escuela debe existir
3. **Máximo 3 directores por escuela**: Una escuela puede tener hasta 3 directores.
4. **Director solo en su escuela**: Los directores solo pueden registrar en su propia escuela, ver y asignar libros de su escuela. Al registrar un alumno, el director puede omitir `idEscuela` y se usará su escuela automáticamente.
5. **No eliminar escuela con datos**: No se puede eliminar escuela si tiene alumnos/maestros
6. **Máximo 3 admins iniciales**: Solo los primeros 3 admins se pueden crear sin autenticación
7. **Maestros y Alumno_Maestro**: Los maestros gestionan alumnos asignados por materia (tabla `Alumno_Maestro`). Solo pueden asignar alumnos de su misma escuela.
8. **Escuela_Libro único**: No se puede asignar el mismo libro dos veces a la misma escuela (unique escuela_id + libro_id).
9. **Doble verificación libros**: Admin otorga; escuela canjea. Director no ve el código en pendientes (solo título y grado).

---

## 🎯 PUNTOS CLAVE DEL FLUJO

1. **Inicio**: Se crean máximo 3 admins sin autenticación
2. **Autenticación**: Todos los usuarios se autentican con email/password → obtienen JWT
3. **Gestión Global**: Solo admins pueden crear escuelas y directores
4. **Gestión Local**: Directores gestionan su propia escuela (alumnos y maestros)
5. **Gestión por Maestros**: Maestros gestionan sus alumnos asignados (listar, ver, asignar/desasignar por materia). Solo alumnos de su escuela.
6. **Libros y Escuelas**: Los libros no aparecen en la escuela hasta que alguien introduce el código. El admin sube libros al catálogo; la escuela (director) o el admin los activa con el código. Director puede listar y asignar libros de su escuela.
7. **Seguridad**: Cada endpoint valida permisos con guards antes de ejecutar
8. **Validación de Escuela**: Directores y maestros están restringidos a su escuela

---

## 📊 DIAGRAMA DE FLUJO SIMPLIFICADO

```
[Inicio]
  ↓
[Registrar 3 Admins] (público)
  ↓
[Admin hace Login] → Obtiene JWT
  ↓
[Admin crea Escuelas]
  ↓
[Admin asigna Director a Escuela]
  ↓
[Director hace Login] → Obtiene JWT
  ↓
[Director registra Alumnos en SU escuela]
[Director registra Maestros en SU escuela]
  ↓
[Admin también puede registrar Alumnos/Maestros en cualquier escuela]
  ↓
[Maestro hace Login] → Obtiene JWT
  ↓
[Maestro lista sus alumnos] GET /maestros/mis-alumnos
[Maestro asigna alumno a su clase] POST /maestros/asignar-alumno
[Maestro desasigna alumno] DELETE /maestros/mis-alumnos/:id/materia/:id
  ↓
[Admin carga Libros] POST /libros/cargar (PDF + titulo, grado, materiaId)
  - Back valida PDF → extrae texto → limpia → segmenta (~200–500 palabras) → guarda Libro, Unidad, Segmentos
  - Guarda PDF en carpeta pdfs/ (ruta_pdf en Libro). Sin IA por ahora. Estado: listo.
  ↓
[Escuela activa libro con código] POST /escuelas/:id/libros { codigo } (“vender” libro a la escuela)
  ↓
[Director ve libros de su escuela] GET /escuelas/:id/libros (solo si id = su escuela)
  ↓
[Alumno hace Login] → Obtiene JWT
  ↓
[Alumno lista libros de su escuela] GET /escuelas/mis-libros
[Alumno lee libro] GET /libros/:id (unidades + segmentos)
[Alumno descarga PDF] GET /libros/:id/pdf
  ↓
[Admin/Director consume libro] GET /libros/:id (unidades + segmentos)
[Descargar PDF] GET /libros/:id/pdf
```

---

## 📚 FLUJO DE LIBROS (ADMIN)

1. **Front sube PDF** + metadatos (titulo, grado, materia, codigo opcional) → `POST /libros/cargar` (multipart).
2. **Back valida PDF** (magic bytes, tamaño min/max), extrae texto con **pdfjs-dist** (Mozilla PDF.js), **limpia** (ligaduras, Unicode, guiones partidos, headers/footers, etc.) y divide en **segmentos** (~200–500 palabras, respetando párrafos y oraciones). No se pierde contenido.
3. **Back guarda** Libro (estado `listo`, num_paginas, **ruta_pdf**), Unidad (p. ej. "Unidad 1"), Segmentos (contenido, orden, id_externo). El **PDF se guarda en la carpeta `pdfs/`** del backend; `ruta_pdf` se persiste en Libro.
4. **Descarga de PDF**: `GET /libros/:id/pdf` devuelve el archivo guardado (solo admin).
5. **Asignar libro a escuela**: Admin o Director llama `POST /escuelas/:id/libros` con `{ "codigo": "LIB-..." }`. Evita doble carga: admin sube, escuela activa con código. La escuela solo ve los libros que tienen asignados (“vender” libro a la escuela). La escuela solo ve los libros que tienen asignados.
6. **Libros de la escuela**: `GET /escuelas/:id/libros`. Admin: cualquier escuela. Director: solo su escuela.
8. **IA** (futuro): por ahora no se integra.
9. **Front consume** libro ya procesado con `GET /libros/:id` (unidades + segmentos).

**Regla**: Frontend = UI y experiencia. Backend = procesamiento, reglas educativas. IA solo en la carga del libro.

---

## ✅ ESTADO ACTUAL DEL SISTEMA

- ✅ Autenticación JWT funcionando
- ✅ Roles y permisos implementados
- ✅ CRUD de escuelas (solo admin)
- ✅ **Escuela–Libros (doble verificación)**: Admin otorga (`POST /escuelas/:id/libros`), director canjea (`POST /escuelas/:id/libros/canjear`). Pendientes: `GET /escuelas/:id/libros/pendientes` (director ve solo título/grado). Activos: `GET /escuelas/:id/libros`.
- ✅ Registro de directores (solo admin)
- ✅ Registro de alumnos (admin o director con restricciones)
- ✅ Registro de maestros (admin o director con restricciones)
- ✅ Registro de padres (solo admin)
- ✅ Gestión de alumnos por maestros (listar, ver, asignar, desasignar)
- ✅ Entidades Materia y Alumno_Maestro para asignación alumno–maestro por materia
- ✅ **Carga de libros** (admin): PDF → validación → extracción → limpieza exhaustiva → segmentación (~200–500 palabras) → Libro, Unidad, Segmentos. **PDF guardado en `pdfs/`**, `ruta_pdf` en Libro. Sin IA.
- ✅ **Descarga de PDF**: `GET /libros/:id/pdf` (admin).
- ✅ Validaciones de seguridad implementadas
- ✅ Guards funcionando correctamente (Admin, Director, AdminOrDirector, Maestro)
- ✅ **Front de pruebas** (`front-prueba/`): Admin (libros, escuelas, otorgar libro, eliminar libro). Director (registrar alumno/maestro sin idEscuela, canjear libro, ver pendientes/activos). **Alumno** (biblioteca digital: `GET /escuelas/mis-libros`, lector de libros, descarga PDF).
- ✅ **AlumnoGuard** y **AdminOrDirectorOrAlumnoGuard** para acceso de alumnos a libros de su escuela.

---

---

## 📚 Documentación relacionada

| Documento | Uso |
|-----------|-----|
| [README.md](./README.md) | Índice central de toda la documentación e inicio rápido |
| [RUTAS_ADMIN_FRONTEND.md](./RUTAS_ADMIN_FRONTEND.md) | Rutas detalladas para administrador (con ejemplos y tabla resumen) |
| [RUTAS_DIRECTOR_FRONTEND.md](./RUTAS_DIRECTOR_FRONTEND.md) | Rutas para director |
| [API_DOCUMENTACION_FRONTEND.md](./API_DOCUMENTACION_FRONTEND.md) | API completa para frontend (todos los roles) |
| [FLUJO_PADRE_ALUMNO.md](./FLUJO_PADRE_ALUMNO.md) | Flujo padre–alumno (registro, vincular, completar datos) |
| [FLUJO_LIBROS_DOBLE_VERIFICACION.md](./FLUJO_LIBROS_DOBLE_VERIFICACION.md) | Flujo de libros (otorgar → canjear) |
| [SEGURIDAD.md](./SEGURIDAD.md) | Medidas de seguridad y checklist producción |
| [AUDITORIA.md](./AUDITORIA.md) | Módulo de auditoría y acciones registradas |

---

**Última actualización:** Febrero 2025. Incluye búsqueda de alumnos (`GET /personas/alumnos/buscar`), dashboards admin/director y auditoría.
