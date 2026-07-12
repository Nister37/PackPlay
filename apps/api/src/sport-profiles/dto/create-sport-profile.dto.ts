import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsEnum,
  ArrayMinSize,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ActivityTypeDto {
  TRAINING = 'TRAINING',
  COMPETITION = 'COMPETITION',
  CASUAL = 'CASUAL',
  TRAVEL = 'TRAVEL',
}

export class CreateSportProfileDto {
  @ApiProperty({ description: 'Sport profile name', example: 'Volleyball' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Activity types for this sport',
    enum: ActivityTypeDto,
    isArray: true,
    example: ['TRAINING', 'COMPETITION'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(ActivityTypeDto, { each: true })
  activityTypes!: ActivityTypeDto[];
}
