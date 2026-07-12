import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsModule } from './notifications.module';
import { NotificationsService } from './notifications.service';
import { CommonModule } from '../common/common.module';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

describe('NotificationsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CommonModule, NotificationsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        notification: {
          create: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
          count: jest.fn(),
        },
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

  it('should provide NotificationsService', () => {
    const service = module.get<NotificationsService>(NotificationsService);
    expect(service).toBeDefined();
  });
});
