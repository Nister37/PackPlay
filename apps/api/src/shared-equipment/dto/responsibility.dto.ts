import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';
import { SharedResponsibilityStatus } from '@prisma/client';

export class ClaimResponsibilityDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class PackResponsibilityDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class ExtraResponsibilityDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class ReportMissingDto {
  @IsEnum(['FORGOT', 'COULD_NOT_BRING', 'REPLACEMENT_ARRANGED'] as const)
  reason!: 'FORGOT' | 'COULD_NOT_BRING' | 'REPLACEMENT_ARRANGED';
}

export class TransferResponsibilityDto {
  @IsUUID()
  @IsNotEmpty()
  targetUserId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class TakeOverDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
