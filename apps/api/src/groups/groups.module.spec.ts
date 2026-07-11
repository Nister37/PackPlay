import { Test, TestingModule } from '@nestjs/testing';
import { GroupsModule } from './groups.module';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { CommonModule } from '../common/common.module';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

describe('GroupsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CommonModule, GroupsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        group: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
        groupMember: { findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn(), update: jest.fn(), count: jest.fn() },
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

  it('should provide GroupsService', () => {
    const service = module.get<GroupsService>(GroupsService);
    expect(service).toBeDefined();
  });

  it('should provide GroupsController', () => {
    const controller = module.get<GroupsController>(GroupsController);
    expect(controller).toBeDefined();
  });
});
