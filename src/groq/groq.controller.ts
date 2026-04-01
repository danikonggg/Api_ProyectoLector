import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { GroqService } from './groq.service';
import { GroqPromptDto } from './dto/groq-prompt.dto';

@Controller('groq-test')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth('JWT-auth')
@ApiTags('Solo Administrador')
export class GroqController {
  constructor(private readonly groqService: GroqService) {}

  @Get()
  @ApiOperation({ summary: 'Prueba Groq AI - prompt fijo (requiere admin)' })
  async test() {
    return this.groqService.testGroq();
  }

  @Post()
  @ApiOperation({ summary: 'Groq AI - envía tu texto (requiere admin)' })
  @ApiBody({ type: GroqPromptDto, description: 'Campo "prompt": el texto que quieras enviar a Groq' })
  async testCustom(@Body() body: GroqPromptDto) {
    return this.groqService.testGroq(body.prompt);
  }
}
