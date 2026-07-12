import {
  Body,
  Controller,
  Get,
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
  @ApiOperation({ summary: 'Release responsibility for a shared item' })
  async release(@Param('itemId') itemId: string, @Req() req: any) {
    return this.sharedEquipmentService.releaseResponsibility(itemId, req.user.id);
  }

  @Post('pack')
  @ApiOperation({ summary: 'Mark responsibility as packed' })
  async pack(
    @Param('itemId') itemId: string,
    @Req() req: any,
    @Body() dto: PackResponsibilityDto,
  ) {
    return this.sharedEquipmentService.packResponsibility(itemId, req.user.id, dto);
  }

  @Post('extra')
  @ApiOperation({ summary: 'Bring extra units' })
  async extra(
    @Param('itemId') itemId: string,
    @Req() req: any,
    @Body() dto: ExtraResponsibilityDto,
  ) {
    return this.sharedEquipmentService.addExtra(itemId, req.user.id, dto);
  }

  @Post('report-missing')
  @ApiOperation({ summary: 'Report item as missing (FORGOT/COULD_NOT_BRING/REPLACEMENT_ARRANGED)' })
  async reportMissing(
    @Param('itemId') itemId: string,
    @Req() req: any,
    @Body() dto: ReportMissingDto,
  ) {
    return this.sharedEquipmentService.reportMissing(itemId, req.user.id, dto);
  }

  @Post('take-over')
  @ApiOperation({ summary: 'Take over from a missing item' })
  async takeOver(
    @Param('itemId') itemId: string,
    @Req() req: any,
    @Body() dto: TakeOverDto,
  ) {
    return this.sharedEquipmentService.takeOver(itemId, req.user.id, dto);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Transfer responsibility to another member' })
  async transfer(
    @Param('itemId') itemId: string,
    @Req() req: any,
    @Body() dto: TransferResponsibilityDto,
  ) {
    return this.sharedEquipmentService.transferResponsibility(itemId, req.user.id, dto);
  }

  @Get('coverage')
  @ApiOperation({ summary: 'Get coverage status for a shared item' })
  async getCoverage(@Param('itemId') itemId: string) {
    return this.sharedEquipmentService.getCoverage(itemId);
  }
}
