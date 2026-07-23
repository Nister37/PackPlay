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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupMemberRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';
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
  list(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
  ) {
    return this.members.list(groupId, activityId);
  }

  @Get('members/me/requirements')
  @ApiOperation({ summary: 'Get role-specific personal requirements' })
  requirements(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
    @Req() req: any,
  ) {
    return this.members.personalRequirements(groupId, activityId, req.user.id);
  }

  @Get('activity-log')
  @ApiOperation({ summary: 'List the append-only event activity log' })
  log(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
    @Query() query: EventLogQueryDto,
  ) {
    return this.activityLog.list(groupId, activityId, query);
  }
}
