import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GroupMemberRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';
import { ErrorResponseDto } from '../common';
import { Roles } from '../groups/decorators';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import { ReviewWeatherSuggestionDto, UpdateWeatherRuleDto } from './dto';
import { WeatherService } from './weather.service';

@ApiTags('Weather Preparation')
@ApiBearerAuth()
@Controller('groups/:groupId')
@UseGuards(JwtAuthGuard, GroupMemberGuard)
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  @Get('activities/:activityId/weather')
  @ApiResponse({ status: 200, description: 'Weather snapshot for the activity' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Not a group member', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Activity not found', type: ErrorResponseDto })
  get(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
  ) {
    return this.weather.get(groupId, activityId);
  }

  @Post('activities/:activityId/weather/refresh')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Refresh and evaluate the event-time forecast' })
  @ApiResponse({ status: 201, description: 'Forecast refreshed' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Activity not found', type: ErrorResponseDto })
  refresh(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
  ) {
    return this.weather.refresh(groupId, activityId);
  }

  @Post('activities/:activityId/weather-suggestions/:suggestionId/accept')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiResponse({ status: 201, description: 'Suggestion accepted' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Suggestion not found', type: ErrorResponseDto })
  accept(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
    @Param('suggestionId') suggestionId: string,
    @Req() req: any,
    @Body() dto: ReviewWeatherSuggestionDto,
  ) {
    return this.weather.accept(groupId, activityId, suggestionId, req.user.id, dto);
  }

  @Post('activities/:activityId/weather-suggestions/:suggestionId/dismiss')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiResponse({ status: 201, description: 'Suggestion dismissed' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Suggestion not found', type: ErrorResponseDto })
  dismiss(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
    @Param('suggestionId') suggestionId: string,
    @Req() req: any,
  ) {
    return this.weather.dismiss(groupId, activityId, suggestionId, req.user.id);
  }

  @Patch('weather-rules/:ruleKey')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiResponse({ status: 200, description: 'Rule updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Rule not found', type: ErrorResponseDto })
  updateRule(
    @Param('groupId') groupId: string,
    @Param('ruleKey') ruleKey: string,
    @Body() dto: UpdateWeatherRuleDto,
  ) {
    return this.weather.updateRule(groupId, ruleKey, dto);
  }
}
