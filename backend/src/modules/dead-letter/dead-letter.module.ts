import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DeadLetterService } from './dead-letter.service';
import { DeadLetterController } from './dead-letter.controller';

@Module({
  imports: [AuditModule],
  controllers: [DeadLetterController],
  providers: [DeadLetterService],
  exports: [DeadLetterService],
})
export class DeadLetterModule {}
