import {
  Body,
  Controller,
  Delete,
  Get,
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
import { SharedEquipmentService } from './shared-equipment.service';
import { CreateSharedItemDto, UpdateSharedItemDto } from './dto';

@ApiTags('Shared Items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activities/:activityId/shared-items')
export class SharedItemsController {
  constructor(private readonly sharedEquipmentService: SharedEquipmentService) {}

  @Post()
  @ApiOperation({ summary: 'Add a shared item to an activity' })
  async addSharedItem(
    @Param('activityId') activityId: string,
    @Req() req: any,
    @Body() dto: CreateSharedItemDto,
  ) {
    return this.sharedEquipmentService.addSharedItem(activityId, req.user.id, dto);
  }

  @Patch(':itemId')
  @ApiOperation({ summary: 'Update shared item details' })
  async updateSharedItem(
    @Param('activityId') activityId: string,
    @Param('itemId') itemId: string,
    @Req() req: any,
    @Body() dto: UpdateSharedItemDto,
  ) {
    return this.sharedEquipmentService.updateSharedItem(activityId, itemId, req.user.id, dto);
  }

  @Delete(':itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a shared item' })
  async deleteSharedItem(
    @Param('activityId') activityId: string,
    @Param('itemId') itemId: string,
    @Req() req: any,
  ) {
    return this.sharedEquipmentService.deleteSharedItem(activityId, itemId, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List shared items with coverage status' })
  async listSharedItems(@Param('activityId') activityId: string, @Req() req: any) {
    return this.sharedEquipmentService.listSharedItems(activityId, req.user.id);
  }
}
