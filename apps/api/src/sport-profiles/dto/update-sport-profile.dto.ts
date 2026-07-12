import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  ArrayMinSize,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityTypeDto } from './create-sport-profile.dto';

export class UpdateSportProfileDto {
  @ApiPropertyOptional({ description: 'Sport profile name', example: 'Beach Volleyball' })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Activity types for this sport',
    enum: ActivityTypeDto,
    isArray: true,
    example: ['TRAINING', 'CASUAL'],
  })
  @IsArray()
  @IsOptional()
  @ArrayMinSize(1)
  @IsEnum(ActivityTypeDto, { each: true })
  activityTypes?: ActivityTypeDto[];
}
