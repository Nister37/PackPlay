import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GroupMemberRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';
import { ErrorResponseDto } from '../common';
import { Roles } from '../groups/decorators';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import {
  AssignEventRoleDto,
  CreateEventRoleDto,
  EventLogQueryDto,
  UpdateEventMemberDto,
} from './dto';
import { EventActivityLogService } from './event-activity-log.service';
import { EventMembersService } from './event-members.service';

@ApiTags('Event Members')
@ApiBearerAuth()
@Controller('groups/:groupId/activities/:activityId')
@UseGuards(JwtAuthGuard, GroupMemberGuard)
export class EventMembersController {
  constructor(
    private readonly members: EventMembersService,
    private readonly activityLog: EventActivityLogService,
  ) {}

  @Post('roles')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Create an event-specific role with requirements' })
  @ApiResponse({ status: 201, description: 'Role created' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Activity not found', type: ErrorResponseDto })
  createRole(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
    @Body() dto: CreateEventRoleDto,
  ) {
    return this.members.createRole(groupId, activityId, dto);
  }

  @Post('roles/:roleId/assignments')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Assign an event role to a group member' })
  @ApiResponse({ status: 201, description: 'Role assigned' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Role or activity not found', type: ErrorResponseDto })
  assignRole(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
    @Param('roleId') roleId: string,
    @Body() dto: AssignEventRoleDto,
  ) {
    return this.members.assignRole(groupId, activityId, roleId, dto);
  }

  @Delete('roles/:roleId/assignments/:userId')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Remove an event role without deleting packing decisions' })
  @ApiResponse({ status: 200, description: 'Assignment removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Insufficient role', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Assignment not found', type: ErrorResponseDto })
  removeRole(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
    @Param('roleId') roleId: string,
    @Param('userId') userId: string,
  ) {
    return this.members.removeRole(groupId, activityId, roleId, userId);
  }

  @Patch('members/me')
  @ApiOperation({ summary: 'Set attendance, packing time, and leaving time' })
  @ApiResponse({ status: 200, description: 'Member preferences updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Not a group member', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Activity not found', type: ErrorResponseDto })
  updateSelf(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
    @Req() req: any,
    @Body() dto: UpdateEventMemberDto,
  ) {
    return this.members.updateSelf(groupId, activityId, req.user.id, dto);
  }

  @Get('members')
  @ApiOperation({ summary: 'List event attendance and preparation times' })
  @ApiResponse({ status: 200, description: 'Event members list' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Not a group member', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Activity not found', type: ErrorResponseDto })
  list(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
  ) {
    return this.members.list(groupId, activityId);
  }

  @Get('members/me/requirements')
  @ApiOperation({ summary: 'Get role-specific personal requirements' })
  @ApiResponse({ status: 200, description: 'Personal requirements' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Not a group member', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Activity not found', type: ErrorResponseDto })
  requirements(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
    @Req() req: any,
  ) {
    return this.members.personalRequirements(groupId, activityId, req.user.id);
  }

  @Get('activity-log')
  @ApiOperation({ summary: 'List the append-only event activity log' })
  @ApiResponse({ status: 200, description: 'Paginated activity log' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  @ApiResponse({ status: 403, description: 'Not a group member', type: ErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Activity not found', type: ErrorResponseDto })
  log(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
    @Query() query: EventLogQueryDto,
  ) {
    return this.activityLog.list(groupId, activityId, query);
  }
}
