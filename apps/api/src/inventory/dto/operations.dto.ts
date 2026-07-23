import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryCondition } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class InventoryStockTargetDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  batchId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class ReserveInventoryDto extends InventoryStockTargetDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sharedItemId!: string;
}

export class CheckoutInventoryDto extends InventoryStockTargetDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  holderId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  activityId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  purpose?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}

export class ReturnInventoryDto {
  @ApiPropertyOptional({ minimum: 1, description: 'Required for partial batch return' })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ enum: InventoryCondition })
  @IsOptional()
  @IsEnum(InventoryCondition)
  condition?: InventoryCondition;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ maxLength: 2048 })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2048)
  photoUrl?: string;
}

export class TransferCustodyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  holderId!: string;
}

export class ReportInventoryConditionDto extends InventoryStockTargetDto {
  @ApiProperty({ enum: InventoryCondition })
  @IsEnum(InventoryCondition)
  condition!: InventoryCondition;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ maxLength: 2048 })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2048)
  photoUrl?: string;
}

export class CorrectBatchQuantityDto {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  quantity!: number;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  reason!: string;
}
