import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AppService } from './app.service';
import { GroqPromptDto } from './dto/groq-prompt.dto';

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

  @Get('groq-test')
  @ApiTags('Público')
  @ApiOperation({ summary: 'Prueba Groq AI - prompt fijo' })
  async groqTest() {
    return await this.appService.testGroq();
  }

  @Post('groq-test')
  @ApiTags('Público')
  @ApiOperation({ summary: 'Groq AI - envía tu texto en el body (campo prompt)' })
  @ApiBody({ type: GroqPromptDto, description: 'Campo "prompt": el texto que quieras enviar a Groq' })
  async groqTestCustom(@Body() body: GroqPromptDto) {
    return await this.appService.testGroq(body.prompt);
  }
}
