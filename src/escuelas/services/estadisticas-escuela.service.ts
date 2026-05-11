import { Injectable } from '@nestjs/common';
import { EscuelasService } from '../escuelas.service';

@Injectable()
export class EstadisticasEscuelaService {
  constructor(private readonly escuelasService: EscuelasService) {}

  async obtenerEstadisticasPanel() {
    return this.escuelasService.obtenerEstadisticasPanel();
  }
}
