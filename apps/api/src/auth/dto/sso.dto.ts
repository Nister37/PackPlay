import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class StartSsoDto {
  @ApiPropertyOptional({
    description: 'Optional same-origin client URL used after authentication',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
  @MaxLength(2048)
  returnUrl?: string;
}

export class SsoCallbackDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  state!: string;
}
