import { Module } from '@nestjs/common';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import { InventoryCatalogueService } from './inventory-catalogue.service';
import { InventoryController } from './inventory.controller';
import { InventoryOperationsController } from './inventory-operations.controller';
import { InventoryOperationsService } from './inventory-operations.service';
import { InventoryRecordsController } from './inventory-records.controller';
import { InventoryRecordsService } from './inventory-records.service';

@Module({
  controllers: [
    InventoryController,
    InventoryOperationsController,
    InventoryRecordsController,
  ],
  providers: [
    InventoryCatalogueService,
    InventoryOperationsService,
    InventoryRecordsService,
    GroupMemberGuard,
    GroupRoleGuard,
  ],
  exports: [
    InventoryCatalogueService,
    InventoryOperationsService,
    InventoryRecordsService,
  ],
})
export class InventoryModule {}
