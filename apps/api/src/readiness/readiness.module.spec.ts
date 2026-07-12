import { Test, TestingModule } from '@nestjs/testing';
import { ReadinessModule } from './readiness.module';
import { ReadinessService } from './readiness.service';
import { CommonModule } from '../common/common.module';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

describe('ReadinessModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CommonModule, ReadinessModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        packingSession: { findUnique: jest.fn(), findMany: jest.fn() },
        groupActivity: { findUnique: jest.fn() },
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

  it('should provide ReadinessService', () => {
    const service = module.get<ReadinessService>(ReadinessService);
    expect(service).toBeDefined();
  });
});
