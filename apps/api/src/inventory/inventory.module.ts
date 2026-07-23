import { Module } from '@nestjs/common';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import { InventoryCatalogueService } from './inventory-catalogue.service';
import { InventoryController } from './inventory.controller';
import { InventoryOperationsController } from './inventory-operations.controller';
import { InventoryOperationsService } from './inventory-operations.service';

@Module({
  controllers: [InventoryController, InventoryOperationsController],
  providers: [
    InventoryCatalogueService,
    InventoryOperationsService,
    GroupMemberGuard,
    GroupRoleGuard,
  ],
  exports: [InventoryCatalogueService, InventoryOperationsService],
})
export class InventoryModule {}
