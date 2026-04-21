import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  IsObject,
  IsEnum,
} from 'class-validator';
import { JobStatus } from '@prisma/client';

export class CreateJobDto {
  @ApiProperty({ description: 'Workflow ID to execute' })
  @IsString()
  workflowId!: string;

  @ApiPropertyOptional({ description: 'Input payload — passed to step handlers as-is.' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Callback URL invoked on terminal status. Signed with HMAC-SHA256 — verify the X-FRE-Signature header.',
  })
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true })
  @MaxLength(2048)
  callbackUrl?: string;
}

export class ListJobsDto {
  @ApiPropertyOptional({ enum: JobStatus })
  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workflowId?: string;
}
