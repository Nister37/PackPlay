import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Headers,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './services/auth.service';
import { JwtAuthGuard } from './guards';
import {
  RegisterDto,
  LoginDto,
  VerifyEmailDto,
  ResendVerificationDto,
  RefreshTokenDto,
  PasswordResetRequestDto,
  PasswordResetConfirmDto,
} from './dto';

const AUTH_RATE_LIMIT = process.env.NODE_ENV === 'test' ? 1000 : 5;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: AUTH_RATE_LIMIT, ttl: 60000 } })
  @ApiOperation({ summary: 'Register a new account' })
  @ApiResponse({ status: 201, description: 'Account created' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto.email, dto.password, dto.name);
    return { message: 'Registration successful. Please verify your email.', ...result };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with token' })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.authService.verifyEmail(dto.token);
    return { message: 'Email verified successfully' };
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: AUTH_RATE_LIMIT, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({ status: 200, description: 'Verification email sent if account exists' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendVerification(dto.email);
    return { message: 'If an account with this email exists, a verification email has been sent' };
  }

  @Post('login')
  @Throttle({ default: { limit: AUTH_RATE_LIMIT, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string) {
    const tokens = await this.authService.login(dto.email, dto.password, userAgent);
    return tokens;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke session' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(@Req() req: any, @Body() dto: RefreshTokenDto) {
    await this.authService.logout(req.user.id, dto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'New token pair' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Headers('user-agent') userAgent?: string) {
    const tokens = await this.authService.refresh(dto.refreshToken, userAgent);
    return tokens;
  }

  @Post('password-reset/request')
  @Throttle({ default: { limit: AUTH_RATE_LIMIT, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  async passwordResetRequest(@Body() dto: PasswordResetRequestDto) {
    await this.authService.requestPasswordReset(dto.email);
    return { message: 'If an account with this email exists, a reset email has been sent' };
  }

  @Post('password-reset/confirm')
  @Throttle({ default: { limit: AUTH_RATE_LIMIT, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set new password with reset token' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async passwordResetConfirm(@Body() dto: PasswordResetConfirmDto) {
    await this.authService.confirmPasswordReset(dto.token, dto.newPassword);
    return { message: 'Password reset successful. All sessions have been revoked.' };
  }
}
