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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GroupMemberRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';
import { ErrorResponseDto } from '../common';
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
  @ApiResponse({ status: 200, description: 'Paginated inventory items' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Not a group member', type: ErrorResponseDto })
  list(@Param('groupId') groupId: string, @Query() query: InventoryQueryDto) {
    return this.catalogue.list(groupId, query);
  }

  @Get(':itemId')
  @ApiOperation({ summary: 'Get inventory with availability and custody' })
  @ApiResponse({ status: 200, description: 'Inventory item detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Not a group member', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Item not found', type: ErrorResponseDto })
  get(@Param('groupId') groupId: string, @Param('itemId') itemId: string) {
    return this.catalogue.getItem(groupId, itemId);
  }

  @Post()
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Create a persistent inventory catalogue entry' })
  @ApiResponse({ status: 201, description: 'Item created' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role', type: ErrorResponseDto })
  create(@Param('groupId') groupId: string, @Body() dto: CreateInventoryItemDto) {
    return this.catalogue.createItem(groupId, dto);
  }

  @Patch(':itemId')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiResponse({ status: 200, description: 'Item updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Item not found', type: ErrorResponseDto })
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
  @ApiResponse({ status: 200, description: 'Item archived' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Item not found', type: ErrorResponseDto })
  archive(@Param('groupId') groupId: string, @Param('itemId') itemId: string) {
    return this.catalogue.archiveItem(groupId, itemId);
  }

  @Post(':itemId/batches')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiResponse({ status: 201, description: 'Batch created' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Item not found', type: ErrorResponseDto })
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
  @ApiResponse({ status: 201, description: 'Asset created' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Item not found', type: ErrorResponseDto })
  createAsset(
    @Param('groupId') groupId: string,
    @Param('itemId') itemId: string,
    @Body() dto: CreateInventoryAssetDto,
  ) {
    return this.catalogue.createAsset(groupId, itemId, dto);
  }

  @Get('locations/all')
  @ApiResponse({ status: 200, description: 'List of storage locations' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Not a group member', type: ErrorResponseDto })
  listLocations(@Param('groupId') groupId: string) {
    return this.catalogue.listLocations(groupId);
  }

  @Post('locations')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiResponse({ status: 201, description: 'Location created' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role', type: ErrorResponseDto })
  createLocation(
    @Param('groupId') groupId: string,
    @Body() dto: CreateStorageLocationDto,
  ) {
    return this.catalogue.createLocation(groupId, dto);
  }
}
