import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { AcceptSmartDraftDto } from './dto';
import { SmartDraftsService } from './smart-drafts.service';

@ApiTags('Smart Add Drafts')
@ApiBearerAuth()
@Controller('activities/:activityId/smart-drafts')
@UseGuards(JwtAuthGuard)
export class SmartDraftsController {
  constructor(private readonly drafts: SmartDraftsService) {}

  @Post('accept')
  @ApiOperation({
    summary: 'Persist only explicitly accepted browser-generated draft items',
    description:
      'This endpoint accepts structured items only. Browser AI prompts and raw model output are never accepted or stored.',
  })
  accept(
    @Param('activityId') activityId: string,
    @Req() req: any,
    @Body() dto: AcceptSmartDraftDto,
  ) {
    return this.drafts.accept(activityId, req.user.id, dto);
  }
}
