import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { RecoveryStrategy, StepType } from '@prisma/client';

export class CreateRecoveryPolicyDto {
  @ApiProperty({ enum: RecoveryStrategy })
  @IsEnum(RecoveryStrategy)
  strategy!: RecoveryStrategy;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional() @IsInt() @Min(0) @Max(100)
  maxRetries?: number;

  @ApiPropertyOptional({ default: 1000 })
  @IsOptional() @IsInt() @Min(0) @Max(60_000)
  retryDelayMs?: number;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional() @IsNumber() @Min(1) @Max(10)
  backoffMultiplier?: number;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  fallbackService?: string;

  @ApiPropertyOptional({ default: 30_000 })
  @IsOptional() @IsInt() @Min(0) @Max(300_000)
  timeoutMs?: number;
}

export class CreateWorkflowStepDto {
  @ApiProperty()
  @IsString() @MinLength(1)
  name!: string;

  @ApiProperty({ enum: StepType })
  @IsEnum(StepType)
  type!: StepType;

  @ApiProperty()
  @IsInt() @Min(1)
  order!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  isCritical?: boolean;

  @ApiPropertyOptional()
  @IsOptional() @IsObject()
  config?: Record<string, unknown>;

  @ApiPropertyOptional({ type: CreateRecoveryPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateRecoveryPolicyDto)
  recoveryPolicy?: CreateRecoveryPolicyDto;
}

export class CreateWorkflowDto {
  @ApiProperty()
  @IsString() @MinLength(1)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiProperty({ type: [CreateWorkflowStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  steps!: CreateWorkflowStepDto[];
}
