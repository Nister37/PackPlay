import { Module } from '@nestjs/common';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import { PreparationTemplatesController } from './preparation-templates.controller';
import { PreparationTemplatesService } from './preparation-templates.service';
import { EventRecurrenceController } from './event-recurrence.controller';
import { EventRecurrenceService } from './event-recurrence.service';
import { EventMembersController } from './event-members.controller';
import { EventMembersService } from './event-members.service';
import { EventActivityLogService } from './event-activity-log.service';

@Module({
  controllers: [
    PreparationTemplatesController,
    EventRecurrenceController,
    EventMembersController,
  ],
  providers: [
    PreparationTemplatesService,
    EventRecurrenceService,
    EventMembersService,
    EventActivityLogService,
    GroupMemberGuard,
    GroupRoleGuard,
  ],
  exports: [
    PreparationTemplatesService,
    EventRecurrenceService,
    EventMembersService,
    EventActivityLogService,
  ],
})
export class EventPlanningModule {}
