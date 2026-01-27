# 📊 ANÁLISIS COMPLETO DEL FLUJO DEL SISTEMA

## 🎯 Resumen Ejecutivo

Sistema educativo con roles jerárquicos donde:
- **Administradores**: Gestionan todo el sistema (escuelas, directores, usuarios)
- **Directores**: Gestionan su propia escuela (alumnos y maestros)
- **Maestros**: Enseñan en una escuela específica
- **Alumnos**: Estudian en una escuela específica
- **Padres**: Tienen hijos (alumnos) en el sistema

---

## 🔄 FLUJO COMPLETO DEL SISTEMA

### **FASE 1: INICIALIZACIÓN** (Sin autenticación)

#### 1.1 Registro de Administradores Iniciales
```
POST /auth/registro-admin
```
- **Permisos**: Público (sin autenticación)
- **Límite**: Máximo 3 administradores
- **Validación**: 
  - Email único
  - Contraseña mínimo 6 caracteres
  - Verifica que no se excedan 3 admins
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
  - Escuela no tiene director asignado (1 director por escuela)
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
Verifica escuela NO tiene director
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
Body: { ...datos, idEscuela }
```
- **Permisos**: AdminOrDirectorGuard
- **Validaciones**:
  - Email único
  - Escuela existe
  - **Si es Director**: Solo puede registrar en SU escuela
  - **Si es Admin**: Puede registrar en cualquier escuela

**Flujo:**
```
Admin/Director → POST /personas/registro-alumno
  ↓
JwtAuthGuard valida token
  ↓
AdminOrDirectorGuard verifica (admin OR director)
  ↓
Si es Director:
  - Verifica idEscuela === director.escuelaId
  - Si no coincide → 403 Forbidden
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

**Validación Especial para Directores:**
```typescript
if (user.tipoPersona === 'director' && user.director) {
  if (registroDto.idEscuela !== user.director.escuelaId) {
    throw ForbiddenException('Solo puede registrar en su escuela');
  }
}
```

---

### **FASE 6: REGISTRO DE MAESTROS** (Admin o Director)

#### 6.1 Registrar Maestro
```
POST /personas/registro-maestro
Authorization: Bearer <token_admin_o_director>
Body: { ...datos, idEscuela }
```
- **Permisos**: AdminOrDirectorGuard
- **Validaciones**: Igual que alumnos
  - Email único
  - Escuela existe
  - **Si es Director**: Solo puede registrar en SU escuela
  - **Si es Admin**: Puede registrar en cualquier escuela

**Flujo:** Idéntico al de alumnos, pero crea Maestro en lugar de Alumno

---

### **FASE 7: REGISTRO DE PADRES** (Solo Administradores)

#### 7.1 Registrar Padre
```
POST /personas/registro-padre
Authorization: Bearer <token_admin>
Body: { ...datos }
```
- **Permisos**: AdminGuard
- **Validaciones**: Email único
- **Nota**: Los padres no están asociados a escuela directamente

---

### **FASE 8: CONSULTAS** (Solo Administradores)

#### 8.1 Listar Administradores
```
GET /personas/admins
Authorization: Bearer <token_admin>
```
- **Permisos**: AdminGuard
- **Retorna**: Lista de todos los administradores

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

---

## 📋 MATRIZ DE PERMISOS

| Endpoint | Público | Admin | Director | Maestro | Alumno | Padre |
|----------|--------|-------|----------|---------|--------|-------|
| `POST /auth/login` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `POST /auth/registro-admin` | ✅ (máx 3) | - | - | - | - | - |
| `GET /auth/profile` | - | ✅ | ✅ | ✅ | ✅ | ✅ |
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
| `GET /maestros/mis-alumnos` | - | ❌ | ❌ | ✅ | ❌ | ❌ |
| `GET /maestros/mis-alumnos/:id` | - | ❌ | ❌ | ✅ | ❌ | ❌ |
| `POST /maestros/asignar-alumno` | - | ❌ | ❌ | ✅ | ❌ | ❌ |
| `DELETE /maestros/mis-alumnos/:alumnoId/materia/:materiaId` | - | ❌ | ❌ | ✅ | ❌ | ❌ |
| `POST /libros/cargar` (multipart: PDF + metadatos) | - | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GET /libros` | - | ✅ | ❌ | ❌ | ❌ | ❌ |
| `GET /libros/:id` | - | ✅ | ❌ | ❌ | ❌ | ❌ |

*Directores solo pueden registrar en su propia escuela
*Maestros solo gestionan alumnos asignados a su clase (Alumno_Maestro) y de su misma escuela

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
```

### Escenario 2: Director Gestiona Su Escuela

```
1. POST /auth/login (director se autentica)
   ↓
2. POST /personas/registro-alumno (registra alumno en SU escuela)
   ↓
3. POST /personas/registro-maestro (registra maestro en SU escuela)
```

**Restricción**: Si el director intenta registrar en otra escuela → 403 Forbidden

### Escenario 3: Maestro Gestiona Sus Alumnos

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

Alumno_Maestro (asignación alumno–maestro por materia):
  alumno_id, maestro_id, materia_id, fecha_inicio, fecha_fin
Materia (materia/asignatura): id, nombre, descripcion, nivel
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
3. **Un director por escuela**: No se puede asignar dos directores a la misma escuela
4. **Director solo en su escuela**: Los directores solo pueden registrar en su propia escuela
5. **No eliminar escuela con datos**: No se puede eliminar escuela si tiene alumnos/maestros
6. **Máximo 3 admins iniciales**: Solo los primeros 3 admins se pueden crear sin autenticación
7. **Maestros y Alumno_Maestro**: Los maestros gestionan alumnos asignados por materia (tabla `Alumno_Maestro`). Solo pueden asignar alumnos de su misma escuela.

---

## 🎯 PUNTOS CLAVE DEL FLUJO

1. **Inicio**: Se crean máximo 3 admins sin autenticación
2. **Autenticación**: Todos los usuarios se autentican con email/password → obtienen JWT
3. **Gestión Global**: Solo admins pueden crear escuelas y directores
4. **Gestión Local**: Directores gestionan su propia escuela (alumnos y maestros)
5. **Gestión por Maestros**: Maestros gestionan sus alumnos asignados (listar, ver, asignar/desasignar por materia). Solo alumnos de su escuela.
6. **Seguridad**: Cada endpoint valida permisos con guards antes de ejecutar
7. **Validación de Escuela**: Directores y maestros están restringidos a su escuela

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
  - Back extrae texto → limpia → segmenta (~100–200 palabras) → guarda Libro, Unidad, Segmentos
  - Sin IA por ahora. Estado: listo.
  ↓
[Front consume libro listo] GET /libros/:id (unidades + segmentos)
```

---

## 📚 FLUJO DE LIBROS (ADMIN)

1. **Front sube PDF** + metadatos (titulo, grado, materia) → `POST /libros/cargar` (multipart).
2. **Back extrae texto** con pdf-parse, limpia (saltos de línea, guiones partidos) y divide en **segmentos** (~100–200 palabras, 1 idea por segmento).
3. **Back guarda** Libro (estado `listo`, num_paginas), Unidad (p. ej. "Unidad 1"), Segmentos (contenido, orden, id_externo).
4. **IA** (futuro): por ahora no se integra. Luego se podría generar preguntas/conceptos por segmento en la carga.
5. **Front consume** libro ya procesado con `GET /libros/:id` (unidades + segmentos). El front no ejecuta IA ni lógica educativa.

**Regla**: Frontend = UI y experiencia. Backend = procesamiento, reglas educativas. IA solo en la carga del libro.

---

## ✅ ESTADO ACTUAL DEL SISTEMA

- ✅ Autenticación JWT funcionando
- ✅ Roles y permisos implementados
- ✅ CRUD de escuelas (solo admin)
- ✅ Registro de directores (solo admin)
- ✅ Registro de alumnos (admin o director con restricciones)
- ✅ Registro de maestros (admin o director con restricciones)
- ✅ Registro de padres (solo admin)
- ✅ Gestión de alumnos por maestros (listar, ver, asignar, desasignar)
- ✅ Entidades Materia y Alumno_Maestro para asignación alumno–maestro por materia
- ✅ **Carga de libros** (admin): PDF → extracción texto → limpieza → segmentos → Libro, Unidad, Segmentos. Sin IA.
- ✅ Validaciones de seguridad implementadas
- ✅ Guards funcionando correctamente (Admin, Director, AdminOrDirector, Maestro)

---

**Última actualización**: Sistema con roles jerárquicos, permisos granulares, gestión de alumnos por maestros y flujo de libros (PDF → segmentos).
