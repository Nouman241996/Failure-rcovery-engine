import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import { QueueService } from './queue.service';
import { REDIS_CLIENT, QUEUE_NAMES } from './queue.constants';
import type { AppEnv } from '../../common/config/env';

export { REDIS_CLIENT, QUEUE_NAMES };

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService<AppEnv, true>) =>
        new IORedis({
          host: config.get('REDIS_HOST', { infer: true }),
          port: config.get('REDIS_PORT', { infer: true }),
          password: config.get('REDIS_PASSWORD', { infer: true }),
          tls: config.get('REDIS_TLS', { infer: true }) ? {} : undefined,
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        }),
      inject: [ConfigService],
    },
    QueueService,
  ],
  exports: [REDIS_CLIENT, QueueService],
})
export class QueueModule {}
