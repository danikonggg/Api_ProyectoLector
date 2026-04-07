import { Controller, Get, Header } from '@nestjs/common';
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
  async metrics(): Promise<string> {
    return register.metrics();
  }
}
