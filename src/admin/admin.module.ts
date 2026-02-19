import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { Escuela } from '../personas/entities/escuela.entity';
import { Alumno } from '../personas/entities/alumno.entity';
import { Maestro } from '../personas/entities/maestro.entity';
import { Libro } from '../libros/entities/libro.entity';
import { PersonasModule } from '../personas/personas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Escuela, Alumno, Maestro, Libro]),
    PersonasModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
