# 🚀 API REST con NestJS y PostgreSQL - Sistema de Registro de Usuarios

API REST para registro de usuarios con diferentes roles (Administrador, Padre, Alumno, Maestro) basada en el modelo de base de datos del sistema educativo.

---

## 📋 Características

- ✅ **Registro de Administradores** - Hasta 3 administradores iniciales sin autenticación
- ✅ **Registro por Roles** - Administrador, Padre, Alumno, Maestro
- ✅ **Validación de Datos** - Validación automática con class-validator
- ✅ **PostgreSQL** - Base de datos relacional
- ✅ **TypeORM** - ORM para trabajar con la base de datos

---

## 🚀 Inicio Rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar `.env`
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=tu_contraseña
DB_DATABASE=api_lector
PORT=3000
NODE_ENV=development
```

### 3. Crear base de datos
```bash
createdb api_lector
```

### 4. Ejecutar
```bash
npm run start:dev
```

---

## 📚 Endpoints de Registro

### 🔐 Registro de Administradores (Público - Solo 3 iniciales)

**POST** `/personas/registro-admin`

Registra un administrador inicial. Solo se permiten 3 administradores sin autenticación.

```bash
curl -X POST http://localhost:3000/personas/registro-admin \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan",
    "apellidoPaterno": "Pérez",
    "apellidoMaterno": "García",
    "email": "admin@example.com",
    "telefono": "1234567890",
    "fechaNacimiento": "1990-01-01",
    "nivel": "super"
  }'
```

**Verificar cantidad de admins:**
```bash
GET /personas/admins/cantidad
```

### 👨‍👩‍👧 Registro de Padres (Requiere Admin)

**POST** `/personas/registro-padre`

```bash
curl -X POST http://localhost:3000/personas/registro-padre \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "María",
    "apellidoPaterno": "López",
    "apellidoMaterno": "Martínez",
    "email": "padre@example.com",
    "telefono": "0987654321",
    "fechaNacimiento": "1985-05-15"
  }'
```

### 🎓 Registro de Alumnos (Requiere Admin)

**POST** `/personas/registro-alumno`

```bash
curl -X POST http://localhost:3000/personas/registro-alumno \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Carlos",
    "apellidoPaterno": "González",
    "apellidoMaterno": "Sánchez",
    "email": "alumno@example.com",
    "telefono": "5555555555",
    "fechaNacimiento": "2010-03-20",
    "idEscuela": 1,
    "grado": "5",
    "grupo": "A",
    "matricula": "2024001",
    "fechaIngreso": "2024-01-15"
  }'
```

### 👨‍🏫 Registro de Maestros (Requiere Admin)

**POST** `/personas/registro-maestro`

```bash
curl -X POST http://localhost:3000/personas/registro-maestro \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Ana",
    "apellidoPaterno": "Rodríguez",
    "apellidoMaterno": "Fernández",
    "email": "maestro@example.com",
    "telefono": "1111111111",
    "fechaNacimiento": "1988-07-10",
    "idEscuela": 1,
    "especialidad": "Matemáticas",
    "fechaIngreso": "2020-08-01"
  }'
```

### 📋 Consultar Administradores

**GET** `/personas/admins` - Listar todos los administradores

**GET** `/personas/admins/cantidad` - Ver cantidad de admins registrados

---

## 📁 Estructura del Proyecto

```
src/
├── main.ts                    # Punto de entrada
├── app.module.ts             # Módulo principal
├── app.controller.ts          # Controlador principal
│
└── personas/                 # Módulo de registro de usuarios
    ├── personas.module.ts
    ├── personas.controller.ts
    ├── personas.service.ts
    ├── entities/            # Entidades de base de datos
    │   ├── persona.entity.ts
    │   ├── administrador.entity.ts
    │   ├── padre.entity.ts
    │   ├── alumno.entity.ts
    │   ├── maestro.entity.ts
    │   └── escuela.entity.ts
    └── dto/                 # DTOs de validación
        ├── registro-admin.dto.ts
        ├── registro-padre.dto.ts
        ├── registro-alumno.dto.ts
        └── registro-maestro.dto.ts
```

---

## 🗄️ Modelo de Base de Datos

### Entidades Principales

- **Persona**: Entidad base para todos los usuarios
- **Administrador**: Usuario administrador del sistema
- **Padre**: Padre/tutor de alumnos
- **Alumno**: Estudiante
- **Maestro**: Profesor/maestro
- **Escuela**: Escuela (creada por administradores)

### Relaciones

- Persona ↔ Administrador (1:1)
- Persona ↔ Padre (1:1)
- Persona ↔ Alumno (1:1)
- Persona ↔ Maestro (1:1)
- Administrador → Escuela (1:N)
- Escuela → Alumno (1:N)
- Escuela → Maestro (1:N)
- Padre ↔ Alumno (N:M) - Tabla intermedia: `padre_alumno`

---

## ⚠️ Notas Importantes

1. **Solo 3 Administradores Iniciales**: Los primeros 3 administradores se pueden registrar sin autenticación. Después de eso, los nuevos administradores deben ser creados por un admin existente.

2. **Autenticación Pendiente**: Actualmente los endpoints de registro de Padre, Alumno y Maestro están públicos. Se debe agregar autenticación para verificar que el usuario es administrador.

3. **Validación de Email**: El email debe ser único en el sistema.

4. **Sincronización Automática**: En desarrollo, las tablas se crean/actualizan automáticamente. En producción, usar migraciones.

---

## 🛠️ Scripts

```bash
npm run start:dev    # Desarrollo con hot-reload
npm run build        # Compilar
npm run start:prod   # Producción
npm run lint         # Verificar código
```

---

## 📝 Próximos Pasos

- [ ] Agregar autenticación JWT
- [ ] Agregar guards para proteger endpoints de admin
- [ ] Implementar CRUD completo para Escuelas
- [ ] Agregar relaciones entre Padres y Alumnos
- [ ] Implementar módulos de Juegos, Libros y Evaluaciones

---

**¡Listo para usar! 🚀**
