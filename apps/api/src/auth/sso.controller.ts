import {
  BadRequestException,
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
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SsoIntent, SsoProvider } from '@prisma/client';
import { JwtAuthGuard } from './guards';
import { SsoCallbackDto, StartSsoDto } from './dto';
import { SsoService } from './services/sso.service';

@ApiTags('auth')
@Controller(['auth/sso', 'api/auth/sso'])
export class SsoController {
  constructor(
    private readonly service: SsoService,
    private readonly config: ConfigService,
  ) {}

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
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }))
  @ApiOperation({ summary: 'Complete Google sign-in or account linking' })
  async callback(
    @Query() dto: SsoCallbackDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('accept') accept?: string,
    @Res({ passthrough: true }) res?: any,
  ) {
    try {
      if (dto.error) {
        if (accept && accept.includes('text/html') && res && typeof res.redirect === 'function') {
          const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:4200');
          return res.redirect(
            `${frontendUrl}/login?error=${encodeURIComponent(dto.error)}&message=${encodeURIComponent(
              dto.error_description || 'Sign-in was cancelled',
            )}`,
          );
        }
        throw new BadRequestException(dto.error_description || dto.error);
      }

      if (!dto.code || !dto.state) {
        throw new BadRequestException('Authorization code and state are required');
      }

      const result = await this.service.callback(dto.code, dto.state, userAgent);
      if (accept && accept.includes('text/html') && res && typeof res.redirect === 'function') {
        const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:4200');
        const redirectBase = result.returnUrl || `${frontendUrl}/auth/callback`;
        const redirectUrl = new URL(redirectBase, frontendUrl);
        if ('accessToken' in result) {
          redirectUrl.searchParams.set('accessToken', (result as any).accessToken);
          redirectUrl.searchParams.set('refreshToken', (result as any).refreshToken);
          redirectUrl.searchParams.set('user', JSON.stringify((result as any).user));
        } else if ((result as any).pendingApproval) {
          redirectUrl.searchParams.set('pendingApproval', 'true');
          redirectUrl.searchParams.set('requestId', (result as any).requestId || '');
          redirectUrl.searchParams.set('receiverEmail', (result as any).receiverEmail || '');
          redirectUrl.searchParams.set('message', (result as any).message || '');
        } else if ((result as any).linked) {
          redirectUrl.searchParams.set('linked', 'true');
          redirectUrl.searchParams.set('provider', 'GOOGLE');
        }
        return res.redirect(redirectUrl.toString());
      }
      return result;
    } catch (err: any) {
      if (accept && accept.includes('text/html') && res && typeof res.redirect === 'function') {
        const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:4200');
        const errorCode = err?.response?.code || 'SSO_FAILED';
        const message = err?.response?.message || err?.message || 'SSO authentication failed';
        return res.redirect(
          `${frontendUrl}/login?error=${encodeURIComponent(errorCode)}&message=${encodeURIComponent(message)}`,
        );
      }
      throw err;
    }
  }

  @Get('methods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List connected sign-in methods' })
  methods(@Req() request: any) {
    return this.service.listMethods(request.user.id);
  }

  @Get('connect-requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List incoming SSO connect requests for receiver' })
  listConnectRequests(@Req() request: any) {
    return this.service.listConnectRequests(request.user.id);
  }

  @Post('connect-requests/:id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept incoming SSO connect request' })
  acceptConnectRequest(@Req() request: any, @Param('id') id: string) {
    return this.service.acceptConnectRequest(id, request.user.id);
  }

  @Post('connect-requests/:id/decline')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Decline incoming SSO connect request' })
  declineConnectRequest(@Req() request: any, @Param('id') id: string) {
    return this.service.declineConnectRequest(id, request.user.id);
  }

  @Post('request-connect-to-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request connection to another account by email' })
  requestConnectToAccount(
    @Req() request: any,
    @Body('targetEmail') targetEmail: string,
  ) {
    return this.service.requestConnectToAccount(request.user.id, targetEmail);
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
