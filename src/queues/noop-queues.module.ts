import { Global, Module } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { LIBROS_IMPORT_QUEUE } from './libros-import.constants';

/** Sin Redis: token de cola resuelve a undefined (LibrosService hace carga síncrona). */
@Global()
@Module({
  providers: [
    { provide: getQueueToken(LIBROS_IMPORT_QUEUE), useValue: undefined },
  ],
  exports: [getQueueToken(LIBROS_IMPORT_QUEUE)],
})
export class NoopQueuesModule {}
