import { Test, TestingModule } from '@nestjs/testing';
import { InvitationsModule } from './invitations.module';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { CommonModule } from '../common/common.module';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

describe('InvitationsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CommonModule, InvitationsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        groupInvitation: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
        groupMember: { findUnique: jest.fn(), create: jest.fn() },
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

  it('should provide InvitationsService', () => {
    const service = module.get<InvitationsService>(InvitationsService);
    expect(service).toBeDefined();
  });

  it('should provide InvitationsController', () => {
    const controller = module.get<InvitationsController>(InvitationsController);
    expect(controller).toBeDefined();
  });
});
