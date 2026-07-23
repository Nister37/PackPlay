import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupMemberRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';
import { Roles } from '../groups/decorators';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import {
  CreateInventoryAssetDto,
  CreateInventoryBatchDto,
  CreateInventoryItemDto,
  CreateStorageLocationDto,
  InventoryQueryDto,
  UpdateInventoryItemDto,
} from './dto';
import { InventoryCatalogueService } from './inventory-catalogue.service';

@ApiTags('Team Inventory')
@ApiBearerAuth()
@Controller('groups/:groupId/inventory')
@UseGuards(JwtAuthGuard, GroupMemberGuard)
export class InventoryController {
  constructor(private readonly catalogue: InventoryCatalogueService) {}

  @Get()
  @ApiOperation({ summary: 'Search and filter persistent team inventory' })
  list(@Param('groupId') groupId: string, @Query() query: InventoryQueryDto) {
    return this.catalogue.list(groupId, query);
  }

  @Get(':itemId')
  @ApiOperation({ summary: 'Get inventory with availability and custody' })
  get(@Param('groupId') groupId: string, @Param('itemId') itemId: string) {
    return this.catalogue.getItem(groupId, itemId);
  }

  @Post()
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Create a persistent inventory catalogue entry' })
  create(@Param('groupId') groupId: string, @Body() dto: CreateInventoryItemDto) {
    return this.catalogue.createItem(groupId, dto);
  }

  @Patch(':itemId')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  update(
    @Param('groupId') groupId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.catalogue.updateItem(groupId, itemId, dto);
  }

  @Delete(':itemId')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  archive(@Param('groupId') groupId: string, @Param('itemId') itemId: string) {
    return this.catalogue.archiveItem(groupId, itemId);
  }

  @Post(':itemId/batches')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  createBatch(
    @Param('groupId') groupId: string,
    @Param('itemId') itemId: string,
    @Body() dto: CreateInventoryBatchDto,
  ) {
    return this.catalogue.createBatch(groupId, itemId, dto);
  }

  @Post(':itemId/assets')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  createAsset(
    @Param('groupId') groupId: string,
    @Param('itemId') itemId: string,
    @Body() dto: CreateInventoryAssetDto,
  ) {
    return this.catalogue.createAsset(groupId, itemId, dto);
  }

  @Get('locations/all')
  listLocations(@Param('groupId') groupId: string) {
    return this.catalogue.listLocations(groupId);
  }

  @Post('locations')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  createLocation(
    @Param('groupId') groupId: string,
    @Body() dto: CreateStorageLocationDto,
  ) {
    return this.catalogue.createLocation(groupId, dto);
  }
}
