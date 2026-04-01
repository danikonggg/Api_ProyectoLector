import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiTags('Público')
  @ApiOperation({ summary: 'Mensaje de bienvenida' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiTags('Público')
  @ApiOperation({ summary: 'Health check - API y base de datos' })
  async healthCheck() {
    return await this.appService.getHealth();
  }
}
