import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { ErrorResponseDto } from '../common';
import { ReadinessService } from './readiness.service';

@ApiTags('Readiness')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ReadinessController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get('activities/:activityId/readiness')
  @ApiOperation({ summary: 'Get group readiness for an activity' })
  @ApiResponse({ status: 200, description: 'Group readiness summary' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Not a group member', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Activity not found', type: ErrorResponseDto })
  async getGroupReadiness(@Param('activityId') activityId: string, @Req() req: any) {
    return this.readinessService.getGroupReadiness(activityId, req.user.id);
  }

  @Get('packing-sessions/:sessionId/readiness')
  @ApiOperation({ summary: 'Get personal readiness for a packing session' })
  @ApiResponse({ status: 200, description: 'Personal readiness summary' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Packing session not found', type: ErrorResponseDto })
  async getPersonalReadiness(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.readinessService.getPersonalReadiness(req.user.id, sessionId);
  }
}
