import { Module } from '@nestjs/common';
import { GroupActivitiesController } from './group-activities.controller';
import { SharedItemsController } from './shared-items.controller';
import { ResponsibilitiesController } from './responsibilities.controller';
import { SharedEquipmentService } from './shared-equipment.service';
import { GroupMemberGuard } from '../groups/guards';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [
    GroupActivitiesController,
    SharedItemsController,
    ResponsibilitiesController,
  ],
  providers: [SharedEquipmentService, GroupMemberGuard],
  exports: [SharedEquipmentService],
})
export class SharedEquipmentModule {}
