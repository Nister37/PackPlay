import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export enum SmartDraftItemTarget {
  PERSONAL = 'PERSONAL',
  SHARED = 'SHARED',
}

export class AcceptedSmartDraftItemDto {
  @ApiProperty({ enum: SmartDraftItemTarget })
  @IsEnum(SmartDraftItemTarget)
  target!: SmartDraftItemTarget;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  catalogueItemId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required for PERSONAL items',
  })
  @IsOptional()
  @IsUUID()
  checklistId?: string;
}

export class AcceptSmartDraftDto {
  @ApiProperty({ type: [AcceptedSmartDraftItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AcceptedSmartDraftItemDto)
  acceptedItems!: AcceptedSmartDraftItemDto[];
}
