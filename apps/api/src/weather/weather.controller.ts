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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupMemberRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';
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
  refresh(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
  ) {
    return this.weather.refresh(groupId, activityId);
  }

  @Post('activities/:activityId/weather-suggestions/:suggestionId/accept')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
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
  updateRule(
    @Param('groupId') groupId: string,
    @Param('ruleKey') ruleKey: string,
    @Body() dto: UpdateWeatherRuleDto,
  ) {
    return this.weather.updateRule(groupId, ruleKey, dto);
  }
}
