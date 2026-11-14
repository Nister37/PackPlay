import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class StartSsoDto {
  @ApiPropertyOptional({
    description: 'Optional same-origin client URL used after authentication',
  })
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: true, protocols: ['https', 'http'] })
  @MaxLength(2048)
  returnUrl?: string;
}

export class SsoCallbackDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  iss?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authuser?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prompt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  error_description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  session_state?: string;
}
