import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecurrenceFrequency } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRecurrenceDto {
  @ApiProperty({ enum: RecurrenceFrequency })
  @IsEnum(RecurrenceFrequency)
  frequency!: RecurrenceFrequency;

  @ApiPropertyOptional({ minimum: 1, maximum: 52, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  interval?: number;

  @ApiPropertyOptional({ type: [Number], description: 'UTC weekdays, Sunday is 0' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Explicit ISO timestamps used for CUSTOM recurrence',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(365)
  @IsDateString({}, { each: true })
  occurrenceDates?: string[];

  @ApiProperty({ example: 'Europe/Warsaw', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  timezone!: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  until?: string;

  @ApiPropertyOptional({ minimum: 2, maximum: 366 })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(366)
  count?: number;
}
