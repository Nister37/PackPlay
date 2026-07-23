import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CalendarProvider } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class PreviewCalendarUrlDto {
  @ApiProperty()
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2048)
  url!: string;
}

export class PreviewCalendarFileDto {
  @ApiProperty({ description: 'UTF-8 iCalendar content', maxLength: 5_000_000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5_000_000)
  content!: string;
}

export class ConnectCalendarFeedDto extends PreviewCalendarUrlDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ enum: CalendarProvider, default: CalendarProvider.GENERIC })
  @IsOptional()
  @IsEnum(CalendarProvider)
  provider?: CalendarProvider;
}
