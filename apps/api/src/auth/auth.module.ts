import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { ConsoleEmailService } from './services/console-email.service';
import { SmtpEmailService } from './services/smtp-email.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EMAIL_SERVICE } from './interfaces';
import { SsoController } from './sso.controller';
import { SsoCryptoService } from './services/sso-crypto.service';
import { SsoService } from './services/sso.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET environment variable is required');
        }
        const expiresIn = configService.get('JWT_ACCESS_EXPIRATION', '15m');
        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as `${number}m`,
          },
        };
      },
    }),
  ],
  controllers: [AuthController, SsoController],
  providers: [
    AuthService,
    JwtStrategy,
    SsoCryptoService,
    SsoService,
    {
      provide: EMAIL_SERVICE,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const smtpHost = configService.get<string>('SMTP_HOST');
        if (smtpHost) {
          return new SmtpEmailService(configService);
        }
        return new ConsoleEmailService();
      },
    },
  ],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}
