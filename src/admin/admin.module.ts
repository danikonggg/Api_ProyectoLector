import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PersonasModule } from '../personas/personas.module';
import { EscuelasModule } from '../escuelas/escuelas.module';

@Module({
  imports: [PersonasModule, EscuelasModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
