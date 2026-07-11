import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvitationDto {
  @ApiPropertyOptional({ description: 'Hours until expiration (default: 72)', example: 48 })
  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(8760) // max 1 year
  expiresInHours?: number;

  @ApiPropertyOptional({ description: 'Maximum number of uses (null = unlimited)', example: 10 })
  @IsInt()
  @IsOptional()
  @Min(1)
  maxUses?: number;
}
