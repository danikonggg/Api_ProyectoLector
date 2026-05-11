import { Controller, ForbiddenException, Get, Header, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';
import { register } from './infra/telemetry/prometheus-metrics';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiTags('Público')
  @ApiOperation({ summary: 'Mensaje de bienvenida' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  @ApiTags('Público')
  @ApiOperation({ summary: 'Health check - API y base de datos' })
  async healthCheck() {
    return await this.appService.getHealth();
  }

  @Public()
  @Get('metrics')
  @Header('Content-Type', register.contentType)
  @ApiTags('Público')
  @ApiOperation({ summary: 'Métricas Prometheus (scraping desde Docker)' })
  async metrics(@Headers('x-metrics-token') metricsTokenHeader?: string): Promise<string> {
    if (process.env.NODE_ENV === 'test') {
      return register.metrics();
    }
    const expectedToken = process.env.METRICS_TOKEN?.trim();
    if (!expectedToken) {
      throw new ForbiddenException('Métricas deshabilitadas: falta METRICS_TOKEN en el entorno.');
    }
    if (metricsTokenHeader !== expectedToken) {
      throw new ForbiddenException('Acceso a métricas no autorizado.');
    }
    return register.metrics();
  }
}
