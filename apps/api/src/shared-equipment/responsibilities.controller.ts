import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { SharedEquipmentService } from './shared-equipment.service';
import {
  ClaimResponsibilityDto,
  ExtraResponsibilityDto,
  PackResponsibilityDto,
  ReportMissingDto,
  TakeOverDto,
  TransferResponsibilityDto,
} from './dto';

@ApiTags('Shared Responsibilities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('shared-items/:itemId')
export class ResponsibilitiesController {
  constructor(private readonly sharedEquipmentService: SharedEquipmentService) {}

  @Post('claim')
  @ApiOperation({ summary: 'Claim responsibility for a shared item' })
  async claim(
    @Param('itemId') itemId: string,
    @Req() req: any,
    @Body() dto: ClaimResponsibilityDto,
  ) {
    return this.sharedEquipmentService.claimResponsibility(itemId, req.user.id, dto);
  }

  @Post('release')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Release responsibility for a shared item' })
  async release(@Param('itemId') itemId: string, @Req() req: any) {
    return this.sharedEquipmentService.releaseResponsibility(itemId, req.user.id);
  }

  @Post('pack')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark responsibility as packed' })
  async pack(
    @Param('itemId') itemId: string,
    @Req() req: any,
    @Body() dto: PackResponsibilityDto,
  ) {
    return this.sharedEquipmentService.packResponsibility(itemId, req.user.id, dto);
  }

  @Post('extra')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bring extra units' })
  async extra(
    @Param('itemId') itemId: string,
    @Req() req: any,
    @Body() dto: ExtraResponsibilityDto,
  ) {
    return this.sharedEquipmentService.addExtra(itemId, req.user.id, dto);
  }

  @Post('report-missing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Report item as missing (FORGOT/COULD_NOT_BRING/REPLACEMENT_ARRANGED)' })
  async reportMissing(
    @Param('itemId') itemId: string,
    @Req() req: any,
    @Body() dto: ReportMissingDto,
  ) {
    return this.sharedEquipmentService.reportMissing(itemId, req.user.id, dto);
  }

  @Post('take-over')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Take over from a missing item' })
  async takeOver(
    @Param('itemId') itemId: string,
    @Req() req: any,
    @Body() dto: TakeOverDto,
  ) {
    return this.sharedEquipmentService.takeOver(itemId, req.user.id, dto);
  }

  @Post('transfer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer responsibility to another member' })
  async transfer(
    @Param('itemId') itemId: string,
    @Req() req: any,
    @Body() dto: TransferResponsibilityDto,
  ) {
    return this.sharedEquipmentService.transferResponsibility(itemId, req.user.id, dto);
  }

  @Post('transfers/:transferId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a pending responsibility transfer' })
  async acceptTransfer(
    @Param('itemId') itemId: string,
    @Param('transferId') transferId: string,
    @Req() req: any,
  ) {
    return this.sharedEquipmentService.acceptTransfer(itemId, transferId, req.user.id);
  }

  @Get('coverage')
  @ApiOperation({ summary: 'Get coverage status for a shared item' })
  async getCoverage(@Param('itemId') itemId: string, @Req() req: any) {
    return this.sharedEquipmentService.getCoverage(itemId, req.user.id);
  }
}
