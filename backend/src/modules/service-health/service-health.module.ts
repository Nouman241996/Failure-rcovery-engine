import { Global, Module } from '@nestjs/common';
import { ServiceHealthService } from './service-health.service';
import { ServiceHealthController } from './service-health.controller';

@Global()
@Module({
  controllers: [ServiceHealthController],
  providers: [ServiceHealthService],
  exports: [ServiceHealthService],
})
export class ServiceHealthModule {}
