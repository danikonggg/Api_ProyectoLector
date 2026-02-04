# Flujo de libros: doble verificación

## Resumen

Para que un libro aparezca en una escuela deben cumplirse **ambas** condiciones:

1. **Paso 1 (Admin)**: El administrador **otorga** el libro a la escuela.
2. **Paso 2 (Escuela)**: La escuela (director) **canjea** el código.

Si falta cualquiera de las dos, el libro **no** se agrega a la escuela.

---

## Endpoints

### Paso 1: Admin otorga libro

```
POST /escuelas/:id/libros
Authorization: Bearer <token_admin>
Body: { "codigo": "LIB-1735123456-abc12345" }
```

- **Permisos**: Solo administrador.
- **Efecto**: Crea un registro en `Escuela_Libro_Pendiente`. El libro aún no aparece en la escuela.
- **Respuesta 201**: Libro otorgado. La escuela debe canjear el código.
- **409**: Libro ya otorgado o ya canjeado.

### Paso 2: Escuela canjea libro

```
POST /escuelas/:id/libros/canjear
Authorization: Bearer <token_admin_o_director>
Body: { "codigo": "LIB-1735123456-abc12345" }
```

- **Permisos**: Admin o director de esa escuela.
- **Efecto**: Si existe pendiente para esa escuela con ese libro → crea `Escuela_Libro` y elimina el pendiente. El libro ya aparece.
- **400**: El admin no otorgó este libro a la escuela. Solicita que te asignen el libro primero.
- **409**: El libro ya está activo (ya fue canjeado).

### Ver pendientes de canjear

```
GET /escuelas/:id/libros/pendientes
Authorization: Bearer <token_admin_o_director>
```

- Libros otorgados por el admin que la escuela aún no ha canjeado.
- **Director**: solo ve título y grado (sin código). Así no puede copiar el código sin que el admin se lo entregue.
- **Admin**: ve toda la información, incluyendo el código.

### Listar libros activos

```
GET /escuelas/:id/libros
```

- Solo devuelve libros ya canjeados (activos en la escuela).

---

## Flujo típico

1. Admin carga libro → `POST /libros/cargar`
2. Admin otorga a escuela X → `POST /escuelas/X/libros { codigo }`
3. Director de escuela X entra y ve pendientes → `GET /escuelas/X/libros/pendientes`
4. Director canjea → `POST /escuelas/X/libros/canjear { codigo }`
5. Director ve el libro activo → `GET /escuelas/X/libros`

---

## Migración

Ejecutar para crear la tabla `Escuela_Libro_Pendiente`:

```bash
psql -U postgres -d api_lector -f migrations/add_escuela_libro_pendiente.sql
```
