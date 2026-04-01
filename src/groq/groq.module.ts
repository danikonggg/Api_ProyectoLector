import { Module } from '@nestjs/common';
import { GroqController } from './groq.controller';
import { GroqService } from './groq.service';

@Module({
  controllers: [GroqController],
  providers: [GroqService],
  exports: [GroqService],
})
export class GroqModule {}
