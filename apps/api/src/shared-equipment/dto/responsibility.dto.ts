import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';

export class ClaimResponsibilityDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class PackResponsibilityDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class ExtraResponsibilityDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class ReportMissingDto {
  @ApiProperty({ enum: ['FORGOT', 'COULD_NOT_BRING', 'REPLACEMENT_ARRANGED'] })
  @IsEnum(['FORGOT', 'COULD_NOT_BRING', 'REPLACEMENT_ARRANGED'] as const)
  reason!: 'FORGOT' | 'COULD_NOT_BRING' | 'REPLACEMENT_ARRANGED';
}

export class TransferResponsibilityDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  targetUserId!: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class TakeOverDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
