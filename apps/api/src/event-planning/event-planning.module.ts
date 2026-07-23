import { Module } from '@nestjs/common';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import { PreparationTemplatesController } from './preparation-templates.controller';
import { PreparationTemplatesService } from './preparation-templates.service';
import { EventRecurrenceController } from './event-recurrence.controller';
import { EventRecurrenceService } from './event-recurrence.service';

@Module({
  controllers: [PreparationTemplatesController, EventRecurrenceController],
  providers: [
    PreparationTemplatesService,
    EventRecurrenceService,
    GroupMemberGuard,
    GroupRoleGuard,
  ],
  exports: [PreparationTemplatesService, EventRecurrenceService],
})
export class EventPlanningModule {}
