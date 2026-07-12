import { Module } from '@nestjs/common';
import { SportProfilesModule } from '../sport-profiles/sport-profiles.module';
import { ChecklistsController } from './checklists.controller';
import { ChecklistsService } from './checklists.service';

@Module({
  imports: [SportProfilesModule],
  controllers: [ChecklistsController],
  providers: [ChecklistsService],
  exports: [ChecklistsService],
})
export class ChecklistsModule {}
