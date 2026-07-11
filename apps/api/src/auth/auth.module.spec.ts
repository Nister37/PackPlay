import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth.module';
import { AuthController } from './auth.controller';
import { AuthService } from './services/auth.service';
import { PrismaService } from '../common/prisma.service';
import { CommonModule } from '../common/common.module';
import { RedisService } from '../common/redis.service';

describe('AuthModule (integration)', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              JWT_SECRET: 'test-secret',
              JWT_ACCESS_EXPIRATION: '15m',
              REDIS_HOST: 'localhost',
              REDIS_PORT: 6379,
            }),
          ],
        }),
        CommonModule,
        AuthModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        user: { findUnique: jest.fn() },
        identity: { update: jest.fn() },
        session: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
        emailVerificationToken: { create: jest.fn(), findUnique: jest.fn() },
        passwordResetToken: { create: jest.fn(), findUnique: jest.fn() },
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $transaction: jest.fn(),
      })
      .overrideProvider(RedisService)
      .useValue({
        ping: jest.fn().mockResolvedValue('PONG'),
        getClient: jest.fn(),
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .compile();
  });

  it('should compile the module', () => {
    expect(module).toBeDefined();
  });

  it('should have AuthController defined', () => {
    const controller = module.get<AuthController>(AuthController);
    expect(controller).toBeDefined();
  });

  it('should have AuthService defined', () => {
    const service = module.get<AuthService>(AuthService);
    expect(service).toBeDefined();
  });
});
