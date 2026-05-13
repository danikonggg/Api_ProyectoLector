# Guía de Migración: TypeORM a Prisma

## 1. Estructura Actual del Proyecto

**Con TypeORM:**
```
src/
  modulo/
    entities/
      mi-entidad.entity.ts
    repositories/
      mi-entidad.repository.ts
    servicios/
      mi-entidad.service.ts
    mi-entidad.module.ts
```

**Con Prisma:**
- No hay necesidad de carpeta `entities/` (el schema.prisma define la estructura)
- No hay necesidad de `repositories/` (Prisma Client es el ORM)
- Los servicios usan `PrismaService` directamente

## 2. Ejemplo de Migración: Módulo Persona

### Antes (TypeORM):
```typescript
// personas.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Persona } from './entities/persona.entity';

@Injectable()
export class PersonasService {
  constructor(
    @InjectRepository(Persona)
    private personasRepository: Repository<Persona>,
  ) {}

  async findAll() {
    return this.personasRepository.find();
  }

  async findOne(id: number) {
    return this.personasRepository.findOneBy({ id });
  }

  async create(data: CreatePersonaDto) {
    const persona = this.personasRepository.create(data);
    return this.personasRepository.save(persona);
  }
}
```

### Después (Prisma):
```typescript
// personas.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../infra/prisma/prisma.service';

@Injectable()
export class PersonasService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.persona.findMany();
  }

  async findOne(id: bigint) {
    return this.prisma.persona.findUnique({
      where: { id },
    });
  }

  async create(data: CreatePersonaDto) {
    return this.prisma.persona.create({
      data,
    });
  }
}
```

### Actualizar el Módulo:
```typescript
// personas.module.ts
import { Module } from '@nestjs/common';
import { PersonasService } from './personas.service';
import { PersonasController } from './personas.controller';

@Module({
  // REMOVER: TypeOrmModule.forFeature([Persona])
  providers: [PersonasService],
  controllers: [PersonasController],
})
export class PersonasModule {}
```

## 3. Operaciones Comunes: TypeORM → Prisma

### Buscar todos (con paginación):
**TypeORM:**
```typescript
const result = await this.repo.find({
  skip: (page - 1) * limit,
  take: limit,
});
```

**Prisma:**
```typescript
const result = await this.prisma.model.findMany({
  skip: (page - 1) * limit,
  take: limit,
});
```

### Buscar con condiciones:
**TypeORM:**
```typescript
const result = await this.repo.find({
  where: { estado: 'activo' },
});
```

**Prisma:**
```typescript
const result = await this.prisma.model.findMany({
  where: { estado: 'activo' },
});
```

### Joins/Relaciones:
**TypeORM:**
```typescript
const result = await this.repo.find({
  relations: ['autor', 'comentarios'],
});
```

**Prisma:**
```typescript
const result = await this.prisma.model.findMany({
  include: {
    autor: true,
    comentarios: true,
  },
});
```

### Actualizar:
**TypeORM:**
```typescript
await this.repo.update({ id }, data);
```

**Prisma:**
```typescript
await this.prisma.model.update({
  where: { id },
  data,
});
```

### Eliminar:
**TypeORM:**
```typescript
await this.repo.delete({ id });
```

**Prisma:**
```typescript
await this.prisma.model.delete({
  where: { id },
});
```

## 4. Checklist de Migración por Módulo

- [ ] Actualizar el servicio para usar PrismaService
- [ ] Remover inyección de @InjectRepository
- [ ] Actualizar métodos CRUD
- [ ] Actualizar modulo para remover TypeOrmModule.forFeature
- [ ] Probar que los endpoints funcionen
- [ ] Actualizar DTOs si es necesario
- [ ] Actualizar tests/e2e-specs

## 5. Tipos de Datos Importantes

**BigInt en Prisma:**
- Las IDs en el schema son `BigInt`
- En TypeScript, usar `bigint` (no `number`) para evitar pérdida de precisión
- Prisma convierte automáticamente a/desde BigInt

**Fechas:**
- `@db.Date` - solo la fecha
- `@db.Timestamp` - fecha y hora
- `@db.TimestampTz` - fecha, hora y zona horaria

## 6. Acceso a Modelos

Los modelos generados por Prisma están disponibles:
```typescript
// Ejemplos de acceso
this.prisma.persona.findMany()
this.prisma.alumno.findUnique()
this.prisma.libro.create()
this.prisma.licenciaLibro.delete()
```

El nombre del modelo sigue la convención camelCase del nombre de la tabla.
