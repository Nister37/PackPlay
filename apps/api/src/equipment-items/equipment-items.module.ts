import { Module } from '@nestjs/common';
import { ChecklistsModule } from '../checklists/checklists.module';
import { EquipmentItemsController } from './equipment-items.controller';
import { EquipmentItemsService } from './equipment-items.service';

@Module({
  imports: [ChecklistsModule],
  controllers: [EquipmentItemsController],
  providers: [EquipmentItemsService],
  exports: [EquipmentItemsService],
})
export class EquipmentItemsModule {}
