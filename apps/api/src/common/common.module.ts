import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { CleanupService } from './cleanup.service';

@Global()
@Module({
  providers: [PrismaService, RedisService, CleanupService],
  exports: [PrismaService, RedisService],
})
export class CommonModule {}
