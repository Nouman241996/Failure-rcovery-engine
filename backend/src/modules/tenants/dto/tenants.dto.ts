import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'acme', description: 'URL-safe identifier (unique).' })
  @IsString()
  @MinLength(1)
  slug!: string;

  @ApiProperty({ required: false, default: 120, description: 'Per-minute request budget.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  rateLimit?: number;
}

export class IssueApiKeyDto {
  @ApiProperty({ example: 'production-server-01' })
  @IsString()
  @MinLength(1)
  label!: string;
}
