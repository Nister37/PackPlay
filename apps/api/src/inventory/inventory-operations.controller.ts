import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupMemberRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';
import { Roles } from '../groups/decorators';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import {
  CheckoutInventoryDto,
  ReserveInventoryDto,
  ReturnInventoryDto,
  TransferCustodyDto,
  ReportInventoryConditionDto,
  CorrectBatchQuantityDto,
} from './dto';
import { InventoryOperationsService } from './inventory-operations.service';

@ApiTags('Inventory Operations')
@ApiBearerAuth()
@Controller('groups/:groupId/inventory-operations')
@UseGuards(JwtAuthGuard, GroupMemberGuard)
export class InventoryOperationsController {
  constructor(private readonly operations: InventoryOperationsService) {}

  @Post('reservations')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Atomically reserve inventory for an event requirement' })
  reserve(
    @Param('groupId') groupId: string,
    @Req() req: any,
    @Body() dto: ReserveInventoryDto,
  ) {
    return this.operations.reserve(groupId, req.user.id, dto);
  }

  @Post('reservations/:reservationId/release')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  release(
    @Param('groupId') groupId: string,
    @Param('reservationId') reservationId: string,
    @Req() req: any,
  ) {
    return this.operations.releaseReservation(groupId, reservationId, req.user.id);
  }

  @Post('checkouts')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Check out a batch quantity or asset to a member' })
  checkout(
    @Param('groupId') groupId: string,
    @Req() req: any,
    @Body() dto: CheckoutInventoryDto,
  ) {
    return this.operations.checkout(groupId, req.user.id, dto);
  }

  @Post('custodies/:custodyId/return')
  @ApiOperation({ summary: 'Record a full or partial return with condition' })
  returnCustody(
    @Param('groupId') groupId: string,
    @Param('custodyId') custodyId: string,
    @Req() req: any,
    @Body() dto: ReturnInventoryDto,
  ) {
    return this.operations.returnCustody(groupId, custodyId, req.user.id, dto);
  }

  @Post('custodies/:custodyId/transfer')
  @ApiOperation({ summary: 'Transfer current custody to another group member' })
  transfer(
    @Param('groupId') groupId: string,
    @Param('custodyId') custodyId: string,
    @Req() req: any,
    @Body() dto: TransferCustodyDto,
  ) {
    return this.operations.transferCustody(groupId, custodyId, req.user.id, dto);
  }

  @Post('condition-reports')
  @ApiOperation({ summary: 'Report damage or update stock condition' })
  reportCondition(
    @Param('groupId') groupId: string,
    @Req() req: any,
    @Body() dto: ReportInventoryConditionDto,
  ) {
    return this.operations.reportCondition(groupId, req.user.id, dto);
  }

  @Post('batches/:batchId/corrections')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Append a reasoned batch quantity correction' })
  correctBatch(
    @Param('groupId') groupId: string,
    @Param('batchId') batchId: string,
    @Req() req: any,
    @Body() dto: CorrectBatchQuantityDto,
  ) {
    return this.operations.correctBatch(groupId, batchId, req.user.id, dto);
  }
}
