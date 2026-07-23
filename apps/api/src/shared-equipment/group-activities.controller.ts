import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { GroupMemberRole } from '@prisma/client';
import { Roles } from '../groups/decorators';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import { SharedEquipmentService } from './shared-equipment.service';
import {
  CreateGroupActivityDto,
  ListGroupActivitiesQueryDto,
  UpdateGroupActivityDto,
} from './dto';

@ApiTags('Group Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, GroupMemberGuard)
@Controller('groups/:groupId/activities')
export class GroupActivitiesController {
  constructor(private readonly sharedEquipmentService: SharedEquipmentService) {}

  @Post()
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Create a group activity' })
  async createActivity(
    @Param('groupId') groupId: string,
    @Req() req: any,
    @Body() dto: CreateGroupActivityDto,
  ) {
    return this.sharedEquipmentService.createActivity(groupId, req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List group activities' })
  async listActivities(
    @Param('groupId') groupId: string,
    @Query() query: ListGroupActivitiesQueryDto,
  ) {
    return this.sharedEquipmentService.listActivities(groupId, query);
  }

  @Get(':activityId')
  @ApiOperation({ summary: 'Get activity with shared items' })
  async getActivity(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
  ) {
    return this.sharedEquipmentService.getActivity(groupId, activityId);
  }

  @Patch(':activityId')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Update an event and its venue or lifecycle details' })
  async updateActivity(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
    @Body() dto: UpdateGroupActivityDto,
  ) {
    return this.sharedEquipmentService.updateActivity(groupId, activityId, dto);
  }

  @Post(':activityId/duplicate')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Duplicate an event as a new draft' })
  async duplicateActivity(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
    @Req() req: any,
  ) {
    return this.sharedEquipmentService.duplicateActivity(groupId, activityId, req.user.id);
  }

  @Post(':activityId/archive')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Archive an event while retaining its history' })
  async archiveActivity(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
  ) {
    return this.sharedEquipmentService.archiveActivity(groupId, activityId);
  }
}
