import { IsString, IsOptional, IsEnum, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityTypeDto } from '../../sport-profiles/dto';

export class UpdateChecklistDto {
  @ApiPropertyOptional({ description: 'Checklist name', example: 'Updated gear list' })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    description: 'Activity type filter',
    enum: ActivityTypeDto,
    example: 'TRAINING',
  })
  @IsEnum(ActivityTypeDto)
  @IsOptional()
  activityType?: ActivityTypeDto;
}
