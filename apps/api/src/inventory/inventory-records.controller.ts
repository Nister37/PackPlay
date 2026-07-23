import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupMemberRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';
import { Roles } from '../groups/decorators';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import { GenerateInventoryQrDto, InventoryHistoryQueryDto } from './dto';
import { InventoryRecordsService } from './inventory-records.service';

@ApiTags('Inventory Records')
@ApiBearerAuth()
@Controller()
export class InventoryRecordsController {
  constructor(private readonly records: InventoryRecordsService) {}

  @Get('groups/:groupId/inventory-history')
  @UseGuards(JwtAuthGuard, GroupMemberGuard)
  history(
    @Param('groupId') groupId: string,
    @Query() query: InventoryHistoryQueryDto,
  ) {
    return this.records.history(groupId, query);
  }

  @Get('groups/:groupId/inventory-history.csv')
  @UseGuards(JwtAuthGuard, GroupMemberGuard)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="inventory-history.csv"')
  exportCsv(
    @Param('groupId') groupId: string,
    @Query() query: InventoryHistoryQueryDto,
  ) {
    return this.records.exportCsv(groupId, query);
  }

  @Get('groups/:groupId/inventory-overdue')
  @UseGuards(JwtAuthGuard, GroupMemberGuard)
  overdue(@Param('groupId') groupId: string) {
    return this.records.overdue(groupId);
  }

  @Post('groups/:groupId/inventory-qr')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(JwtAuthGuard, GroupMemberGuard, GroupRoleGuard)
  @ApiOperation({ summary: 'Generate or rotate a printable inventory QR code' })
  generateQr(
    @Param('groupId') groupId: string,
    @Body() dto: GenerateInventoryQrDto,
  ) {
    return this.records.generateQr(groupId, dto);
  }

  @Get('inventory-qr/:token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Resolve an inventory QR for an authenticated member' })
  resolve(@Param('token') token: string, @Req() req: any) {
    return this.records.resolveQr(token, req.user.id);
  }
}
