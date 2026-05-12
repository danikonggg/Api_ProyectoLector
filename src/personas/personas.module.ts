import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PersonasController } from './personas.controller';
import { CargaMasivaService } from './carga-masiva.service';
import { VinculacionPadresService } from './services/vinculacion-padres.service';
import { RegistroPersonasService } from './services/registro-personas.service';
import { ConsultaPersonasService } from './services/consulta-personas.service';
import { GestionPersonasService } from './services/gestion-personas.service';

@Module({
  imports: [AuthModule],
  controllers: [PersonasController],
  providers: [
    CargaMasivaService,
    VinculacionPadresService,
    RegistroPersonasService,
    ConsultaPersonasService,
    GestionPersonasService,
  ],
  exports: [
    CargaMasivaService,
    VinculacionPadresService,
    RegistroPersonasService,
    ConsultaPersonasService,
    GestionPersonasService,
  ],
})
export class PersonasModule {}
