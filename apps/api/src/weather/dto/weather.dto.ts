import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WeatherSuggestionTarget } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class ReviewWeatherSuggestionDto {
  @ApiPropertyOptional({ enum: WeatherSuggestionTarget })
  @IsOptional()
  @IsEnum(WeatherSuggestionTarget)
  target?: WeatherSuggestionTarget;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  itemName?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required when accepting as a personal item',
  })
  @IsOptional()
  @IsUUID()
  checklistId?: string;
}

export class UpdateWeatherRuleDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
