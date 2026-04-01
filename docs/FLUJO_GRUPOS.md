# Flujo de Grupos - API Lector

## Orden recomendado de operaciones

1. **Director crea grupos** → `POST /director/grupos` con `{ grado, nombre }`
2. **Director registra maestros** → Carga masiva o registro individual
3. **Director asigna maestros a grupos** → `POST /director/maestros/asignar-grupo` con `{ maestroId, grupoId }`
4. **Director registra alumnos (o carga masiva)** → Con `grado` y `grupo` en Excel, o `grupoId` en registro

## Migraciones SQL

### Opción 1: Script automático
```bash
chmod +x scripts/run-migrations.sh
./scripts/run-migrations.sh
# O con URL: ./scripts/run-migrations.sh "postgresql://user:pass@host:5432/api_lector"
```

### Opción 2: Manual (en orden)
```bash
psql -U postgres -d api_lector -f migrations/add_grupo_table.sql
psql -U postgres -d api_lector -f migrations/add_maestro_grupo_table.sql
psql -U postgres -d api_lector -f migrations/add_alumno_grupo_id.sql
psql -U postgres -d api_lector -f migrations/backfill_alumno_grupo_id.sql  # alumnos existentes
```

## Validaciones implementadas

- **Carga masiva**: Si se envía grado+grupo, debe existir un Grupo en la escuela. Si no existe → error.
- **Registro alumno**: Si se envía grupoId o grado+grupo, se valida que el Grupo exista.
- **Maestro sin grupos**: No puede asignar alumnos ni libros. Debe tener grupos asignados.
- **Normalización**: Nombres de grupo se guardan en mayúsculas; comparaciones son case-insensitive.
