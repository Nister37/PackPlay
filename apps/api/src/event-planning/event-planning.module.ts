import { Module } from '@nestjs/common';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import { PreparationTemplatesController } from './preparation-templates.controller';
import { PreparationTemplatesService } from './preparation-templates.service';

@Module({
  controllers: [PreparationTemplatesController],
  providers: [PreparationTemplatesService, GroupMemberGuard, GroupRoleGuard],
  exports: [PreparationTemplatesService],
})
export class EventPlanningModule {}
