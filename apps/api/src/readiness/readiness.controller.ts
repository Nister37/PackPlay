import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { ReadinessService } from './readiness.service';

@ApiTags('Readiness')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ReadinessController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get('activities/:activityId/readiness')
  @ApiOperation({ summary: 'Get group readiness for an activity' })
  async getGroupReadiness(@Param('activityId') activityId: string, @Req() req: any) {
    return this.readinessService.getGroupReadiness(activityId, req.user.id);
  }

  @Get('packing-sessions/:sessionId/readiness')
  @ApiOperation({ summary: 'Get personal readiness for a packing session' })
  async getPersonalReadiness(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.readinessService.getPersonalReadiness(req.user.id, sessionId);
  }
}
