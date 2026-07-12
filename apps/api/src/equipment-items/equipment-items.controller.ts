import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { EquipmentItemsService } from './equipment-items.service';
import { CreateEquipmentItemDto, UpdateEquipmentItemDto, ReorderItemsDto } from './dto';

@ApiTags('Equipment Items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('checklists/:checklistId/items')
export class EquipmentItemsController {
  constructor(private readonly equipmentItemsService: EquipmentItemsService) {}

  @Post()
  @ApiOperation({ summary: 'Add item to checklist' })
  async addItem(
    @Param('checklistId') checklistId: string,
    @Req() req: any,
    @Body() dto: CreateEquipmentItemDto,
  ) {
    return this.equipmentItemsService.addItem(checklistId, req.user.id, dto);
  }

  @Patch(':itemId')
  @ApiOperation({ summary: 'Edit an item' })
  async updateItem(
    @Param('checklistId') checklistId: string,
    @Param('itemId') itemId: string,
    @Req() req: any,
    @Body() dto: UpdateEquipmentItemDto,
  ) {
    return this.equipmentItemsService.updateItem(checklistId, itemId, req.user.id, dto);
  }

  @Delete(':itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an item' })
  async deleteItem(
    @Param('checklistId') checklistId: string,
    @Param('itemId') itemId: string,
    @Req() req: any,
  ) {
    return this.equipmentItemsService.deleteItem(checklistId, itemId, req.user.id);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder items in a checklist' })
  async reorderItems(
    @Param('checklistId') checklistId: string,
    @Req() req: any,
    @Body() dto: ReorderItemsDto,
  ) {
    return this.equipmentItemsService.reorderItems(checklistId, req.user.id, dto);
  }
}
