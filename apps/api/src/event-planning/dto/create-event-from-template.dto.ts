import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GroupActivityStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEventFromTemplateDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiPropertyOptional({ minimum: 1, description: 'Defaults to latest version' })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @ApiPropertyOptional({ enum: GroupActivityStatus, default: GroupActivityStatus.DRAFT })
  @IsOptional()
  @IsEnum(GroupActivityStatus)
  status?: GroupActivityStatus;
}
