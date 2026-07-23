import { Body, Controller, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupMemberRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';
import { Roles } from '../groups/decorators';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import { CreateRecurrenceDto, UpdateFutureEventsDto } from './dto';
import { EventRecurrenceService } from './event-recurrence.service';

@ApiTags('Event Recurrence')
@ApiBearerAuth()
@Controller('groups/:groupId')
@Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
@UseGuards(JwtAuthGuard, GroupMemberGuard, GroupRoleGuard)
export class EventRecurrenceController {
  constructor(private readonly recurrence: EventRecurrenceService) {}

  @Post('activities/:activityId/recurrence')
  @ApiOperation({ summary: 'Create independently tracked recurring occurrences' })
  create(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
    @Req() req: any,
    @Body() dto: CreateRecurrenceDto,
  ) {
    return this.recurrence.create(groupId, activityId, req.user.id, dto);
  }

  @Patch('recurrence-series/:seriesId/future/:activityId')
  @ApiOperation({ summary: 'Update this and future occurrences' })
  updateFuture(
    @Param('groupId') groupId: string,
    @Param('seriesId') seriesId: string,
    @Param('activityId') activityId: string,
    @Body() dto: UpdateFutureEventsDto,
  ) {
    return this.recurrence.updateFuture(groupId, seriesId, activityId, dto);
  }

  @Post('activities/:activityId/cancel-occurrence')
  @ApiOperation({ summary: 'Cancel one recurring occurrence' })
  cancel(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
  ) {
    return this.recurrence.cancelOccurrence(groupId, activityId);
  }
}
