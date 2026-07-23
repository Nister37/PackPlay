import { Module } from '@nestjs/common';
import { EquipmentCatalogueController } from './equipment-catalogue.controller';
import { EquipmentCatalogueService } from './equipment-catalogue.service';
import { SmartDraftsController } from './smart-drafts.controller';
import { SmartDraftsService } from './smart-drafts.service';

@Module({
  controllers: [EquipmentCatalogueController, SmartDraftsController],
  providers: [EquipmentCatalogueService, SmartDraftsService],
  exports: [EquipmentCatalogueService, SmartDraftsService],
})
export class EquipmentCatalogueModule {}
