import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventEnvironment, GroupActivityStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateFutureEventsDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ maxLength: 5000 })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  venueName?: string;

  @ApiPropertyOptional({ enum: EventEnvironment })
  @IsOptional()
  @IsEnum(EventEnvironment)
  environment?: EventEnvironment;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  surface?: string;

  @ApiPropertyOptional({ enum: GroupActivityStatus })
  @IsOptional()
  @IsEnum(GroupActivityStatus)
  status?: GroupActivityStatus;
}
