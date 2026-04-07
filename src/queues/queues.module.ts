import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LIBROS_IMPORT_QUEUE } from './libros-import.constants';
import { redisConnectionOptions } from './redis-connection.factory';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        connection: redisConnectionOptions(config),
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: LIBROS_IMPORT_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
