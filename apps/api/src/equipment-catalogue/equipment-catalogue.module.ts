import { Module } from '@nestjs/common';
import { EquipmentCatalogueController } from './equipment-catalogue.controller';
import { EquipmentCatalogueService } from './equipment-catalogue.service';

@Module({
  controllers: [EquipmentCatalogueController],
  providers: [EquipmentCatalogueService],
  exports: [EquipmentCatalogueService],
})
export class EquipmentCatalogueModule {}
