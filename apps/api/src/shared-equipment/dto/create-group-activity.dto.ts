import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ActivityType } from '@prisma/client';

export class CreateGroupActivityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsEnum(ActivityType)
  activityType!: ActivityType;

  @IsOptional()
  @IsUUID()
  sportProfileId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}
