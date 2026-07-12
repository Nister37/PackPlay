import { Test, TestingModule } from '@nestjs/testing';
import { SportProfilesModule } from './sport-profiles.module';
import { SportProfilesService } from './sport-profiles.service';
import { SportProfilesController } from './sport-profiles.controller';
import { CommonModule } from '../common/common.module';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

describe('SportProfilesModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CommonModule, SportProfilesModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        sportProfile: {
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

  it('should provide SportProfilesService', () => {
    const service = module.get<SportProfilesService>(SportProfilesService);
    expect(service).toBeDefined();
  });

  it('should provide SportProfilesController', () => {
    const controller = module.get<SportProfilesController>(SportProfilesController);
    expect(controller).toBeDefined();
  });
});
