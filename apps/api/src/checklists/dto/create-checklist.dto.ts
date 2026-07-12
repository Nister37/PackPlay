import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityTypeDto } from '../../sport-profiles/dto';

export class CreateChecklistDto {
  @ApiProperty({ description: 'Checklist name', example: 'Match day gear' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ description: 'Sport profile ID', example: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  sportProfileId!: string;

  @ApiPropertyOptional({
    description: 'Activity type filter',
    enum: ActivityTypeDto,
    example: 'COMPETITION',
  })
  @IsEnum(ActivityTypeDto)
  @IsOptional()
  activityType?: ActivityTypeDto;
}
