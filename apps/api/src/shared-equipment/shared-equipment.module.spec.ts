import { Test, TestingModule } from '@nestjs/testing';
import { SharedEquipmentModule } from './shared-equipment.module';
import { SharedEquipmentService } from './shared-equipment.service';
import { GroupActivitiesController } from './group-activities.controller';
import { SharedItemsController } from './shared-items.controller';
import { ResponsibilitiesController } from './responsibilities.controller';
import { CommonModule } from '../common/common.module';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

describe('SharedEquipmentModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CommonModule, SharedEquipmentModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        groupActivity: {
          create: jest.fn(),
          findMany: jest.fn(),
          findUnique: jest.fn(),
        },
        sharedItem: {
          create: jest.fn(),
          findUnique: jest.fn(),
          findMany: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        sharedResponsibility: {
          create: jest.fn(),
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        group: { findUnique: jest.fn() },
        groupMember: { findUnique: jest.fn() },
        $transaction: jest.fn(),
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

  it('should provide SharedEquipmentService', () => {
    const service = module.get<SharedEquipmentService>(SharedEquipmentService);
    expect(service).toBeDefined();
  });

  it('should provide GroupActivitiesController', () => {
    const controller = module.get<GroupActivitiesController>(GroupActivitiesController);
    expect(controller).toBeDefined();
  });

  it('should provide SharedItemsController', () => {
    const controller = module.get<SharedItemsController>(SharedItemsController);
    expect(controller).toBeDefined();
  });

  it('should provide ResponsibilitiesController', () => {
    const controller = module.get<ResponsibilitiesController>(ResponsibilitiesController);
    expect(controller).toBeDefined();
  });
});
