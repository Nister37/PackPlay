import { Test, TestingModule } from '@nestjs/testing';
import { EquipmentItemsModule } from './equipment-items.module';
import { EquipmentItemsService } from './equipment-items.service';
import { EquipmentItemsController } from './equipment-items.controller';
import { CommonModule } from '../common/common.module';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

describe('EquipmentItemsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CommonModule, EquipmentItemsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        sportProfile: { findUnique: jest.fn() },
        checklist: { findUnique: jest.fn() },
        equipmentItem: {
          create: jest.fn(),
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          findMany: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
          delete: jest.fn(),
        },
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

  it('should provide EquipmentItemsService', () => {
    const service = module.get<EquipmentItemsService>(EquipmentItemsService);
    expect(service).toBeDefined();
  });

  it('should provide EquipmentItemsController', () => {
    const controller = module.get<EquipmentItemsController>(EquipmentItemsController);
    expect(controller).toBeDefined();
  });
});
