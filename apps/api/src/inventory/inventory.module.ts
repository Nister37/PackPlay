import { Module } from '@nestjs/common';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import { InventoryCatalogueService } from './inventory-catalogue.service';
import { InventoryController } from './inventory.controller';

@Module({
  controllers: [InventoryController],
  providers: [InventoryCatalogueService, GroupMemberGuard, GroupRoleGuard],
  exports: [InventoryCatalogueService],
})
export class InventoryModule {}
