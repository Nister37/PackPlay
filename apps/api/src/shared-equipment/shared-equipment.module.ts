import { Module } from '@nestjs/common';
import { GroupActivitiesController } from './group-activities.controller';
import { SharedItemsController } from './shared-items.controller';
import { ResponsibilitiesController } from './responsibilities.controller';
import { SharedEquipmentService } from './shared-equipment.service';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventPlanningModule } from '../event-planning/event-planning.module';

@Module({
  imports: [NotificationsModule, EventPlanningModule],
  controllers: [
    GroupActivitiesController,
    SharedItemsController,
    ResponsibilitiesController,
  ],
  providers: [SharedEquipmentService, GroupMemberGuard, GroupRoleGuard],
  exports: [SharedEquipmentService],
})
export class SharedEquipmentModule {}
