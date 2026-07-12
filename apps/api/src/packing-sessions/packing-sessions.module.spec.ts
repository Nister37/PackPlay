import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PackingSessionsModule } from './packing-sessions.module';
import { PackingSessionsService } from './packing-sessions.service';
import { CommonModule } from '../common/common.module';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

describe('PackingSessionsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        CommonModule,
        PackingSessionsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue({
        checklist: { findUnique: jest.fn() },
        groupActivity: { findUnique: jest.fn() },
        packingSession: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
        packingDecision: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
        equipmentItem: { findMany: jest.fn() },
        notification: { create: jest.fn() },
        groupMember: { findUnique: jest.fn() },
        sharedResponsibility: { findUnique: jest.fn(), update: jest.fn() },
        sharedItem: { findUnique: jest.fn() },
        $connect: jest.fn(),
        $disconnect: jest.fn(),
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

  it('should provide PackingSessionsService', () => {
    const service = module.get<PackingSessionsService>(PackingSessionsService);
    expect(service).toBeDefined();
  });
});
