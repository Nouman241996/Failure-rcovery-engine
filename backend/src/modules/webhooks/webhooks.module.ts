import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { WebhookService } from './webhook.service';

@Module({
  imports: [AuditModule],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhooksModule {}
