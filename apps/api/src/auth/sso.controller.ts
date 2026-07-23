import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SsoIntent, SsoProvider } from '@prisma/client';
import { JwtAuthGuard } from './guards';
import { SsoCallbackDto, StartSsoDto } from './dto';
import { SsoService } from './services/sso.service';

@ApiTags('auth')
@Controller('auth/sso')
export class SsoController {
  constructor(private readonly service: SsoService) {}

  @Post('google/start')
  @ApiOperation({ summary: 'Start Google sign-in with PKCE' })
  start(@Body() dto: StartSsoDto) {
    return this.service.start(SsoIntent.SIGN_IN, undefined, dto.returnUrl);
  }

  @Post('google/link/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start linking Google to the signed-in account' })
  startLink(@Req() request: any, @Body() dto: StartSsoDto) {
    return this.service.start(SsoIntent.LINK, request.user.id, dto.returnUrl);
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Complete Google sign-in or account linking' })
  callback(@Query() dto: SsoCallbackDto, @Headers('user-agent') userAgent?: string) {
    return this.service.callback(dto.code, dto.state, userAgent);
  }

  @Get('methods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List connected sign-in methods' })
  methods(@Req() request: any) {
    return this.service.listMethods(request.user.id);
  }

  @Delete(':provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect an SSO sign-in method' })
  unlink(
    @Req() request: any,
    @Param('provider', new ParseEnumPipe(SsoProvider)) provider: SsoProvider,
  ) {
    return this.service.unlink(request.user.id, provider);
  }
}
