import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { GroupMemberGuard, GroupRoleGuard } from './guards';
import { Roles } from './decorators';
import { GroupsService } from './groups.service';
import { CreateGroupDto, UpdateGroupDto, UpdateMemberRoleDto } from './dto';

@ApiTags('Groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new group' })
  async createGroup(@Req() req: any, @Body() dto: CreateGroupDto) {
    return this.groupsService.createGroup(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "List user's groups" })
  async listGroups(@Req() req: any) {
    return this.groupsService.listUserGroups(req.user.id);
  }

  @Get(':groupId')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Get group details (members only)' })
  async getGroup(@Param('groupId') groupId: string) {
    return this.groupsService.getGroupDetails(groupId);
  }

  @Patch(':groupId')
  @UseGuards(GroupMemberGuard, GroupRoleGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update group (OWNER/ADMIN only)' })
  async updateGroup(@Param('groupId') groupId: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.updateGroup(groupId, dto);
  }

  @Delete(':groupId')
  @UseGuards(GroupMemberGuard, GroupRoleGuard)
  @Roles('OWNER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete group (OWNER only)' })
  async deleteGroup(@Param('groupId') groupId: string) {
    return this.groupsService.deleteGroup(groupId);
  }

  @Get(':groupId/members')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'List group members' })
  async listMembers(@Param('groupId') groupId: string) {
    return this.groupsService.listMembers(groupId);
  }

  @Delete(':groupId/members/:memberId')
  @UseGuards(GroupMemberGuard, GroupRoleGuard)
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member (OWNER/ADMIN)' })
  async removeMember(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Req() req: any,
  ) {
    return this.groupsService.removeMember(groupId, memberId, req.user.id);
  }

  @Patch(':groupId/members/:memberId')
  @UseGuards(GroupMemberGuard, GroupRoleGuard)
  @Roles('OWNER')
  @ApiOperation({ summary: 'Update member role (OWNER only)' })
  async updateMemberRole(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.groupsService.updateMemberRole(groupId, memberId, dto.role);
  }

  @Post(':groupId/leave')
  @UseGuards(GroupMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a group' })
  async leaveGroup(@Param('groupId') groupId: string, @Req() req: any) {
    return this.groupsService.leaveGroup(groupId, req.user.id);
  }
}
