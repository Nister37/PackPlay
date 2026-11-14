import { Module } from '@nestjs/common';
import { GemmaService } from './gemma.service';
import { GemmaController } from './gemma.controller';

@Module({
  controllers: [GemmaController],
  providers: [GemmaService],
  exports: [GemmaService],
})
export class GemmaModule {}
