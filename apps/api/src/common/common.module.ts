import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { CleanupService } from './cleanup.service';
import { EventBusService } from './event-bus.service';

@Global()
@Module({
  providers: [PrismaService, RedisService, CleanupService, EventBusService],
  exports: [PrismaService, RedisService, EventBusService],
})
export class CommonModule {}
