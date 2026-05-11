import { Injectable } from '@nestjs/common';
import { EscuelasService } from '../escuelas.service';

@Injectable()
export class ConsultaEscuelaService {
  constructor(private readonly escuelasService: EscuelasService) {}

  async listarDirectoresDeEscuela(escuelaId: number) {
    return this.escuelasService.listarDirectoresDeEscuela(escuelaId);
  }

  async listarTodosLosDirectores(page?: number, limit?: number) {
    return this.escuelasService.listarTodosLosDirectores(page, limit);
  }

  async listarMaestrosDeEscuela(escuelaId: number) {
    return this.escuelasService.listarMaestrosDeEscuela(escuelaId);
  }

  async listarAlumnosDeEscuela(escuelaId: number) {
    return this.escuelasService.listarAlumnosDeEscuela(escuelaId);
  }
}
