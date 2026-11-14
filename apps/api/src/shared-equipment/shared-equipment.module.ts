import { Module } from '@nestjs/common';
import { GroupActivitiesController } from './group-activities.controller';
import { SharedItemsController } from './shared-items.controller';
import { ResponsibilitiesController } from './responsibilities.controller';
import { SharedEquipmentService } from './shared-equipment.service';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventPlanningModule } from '../event-planning/event-planning.module';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [
    NotificationsModule,
    EventPlanningModule,
    GroupsModule,
  ],
  controllers: [
    GroupActivitiesController,
    SharedItemsController,
    ResponsibilitiesController,
  ],
  providers: [SharedEquipmentService, GroupMemberGuard, GroupRoleGuard],
  exports: [SharedEquipmentService],
})
export class SharedEquipmentModule {}
