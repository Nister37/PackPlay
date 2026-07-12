import { Module } from '@nestjs/common';
import { SportProfilesController } from './sport-profiles.controller';
import { SportProfilesService } from './sport-profiles.service';

@Module({
  controllers: [SportProfilesController],
  providers: [SportProfilesService],
  exports: [SportProfilesService],
})
export class SportProfilesModule {}
