import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DirectorController } from './director.controller';
import { DirectorService } from './director.service';
import { EscuelasModule } from '../escuelas/escuelas.module';
import { PersonasModule } from '../personas/personas.module';
import { Escuela } from '../personas/entities/escuela.entity';
import { Alumno } from '../personas/entities/alumno.entity';
import { Maestro } from '../personas/entities/maestro.entity';
import { EscuelaLibro } from '../escuelas/entities/escuela-libro.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Escuela, Alumno, Maestro, EscuelaLibro]),
    EscuelasModule,
    PersonasModule,
  ],
  controllers: [DirectorController],
  providers: [DirectorService],
})
export class DirectorModule {}
