import { Test, TestingModule } from '@nestjs/testing';
import { ChecklistsModule } from './checklists.module';
import { ChecklistsService } from './checklists.service';
import { ChecklistsController } from './checklists.controller';
import { CommonModule } from '../common/common.module';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

describe('ChecklistsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CommonModule, ChecklistsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        sportProfile: { findUnique: jest.fn() },
        checklist: {
          create: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
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

  it('should provide ChecklistsService', () => {
    const service = module.get<ChecklistsService>(ChecklistsService);
    expect(service).toBeDefined();
  });

  it('should provide ChecklistsController', () => {
    const controller = module.get<ChecklistsController>(ChecklistsController);
    expect(controller).toBeDefined();
  });
});
