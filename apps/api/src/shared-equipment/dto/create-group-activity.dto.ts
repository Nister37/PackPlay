import { IsEnum, IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';
import { ActivityType } from '@prisma/client';

export class CreateGroupActivityDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(ActivityType)
  activityType!: ActivityType;

  @IsOptional()
  @IsString()
  sportProfileId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
