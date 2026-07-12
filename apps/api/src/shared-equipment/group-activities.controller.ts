import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { GroupMemberGuard } from '../groups/guards';
import { SharedEquipmentService } from './shared-equipment.service';
import { CreateGroupActivityDto } from './dto';

@ApiTags('Group Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, GroupMemberGuard)
@Controller('groups/:groupId/activities')
export class GroupActivitiesController {
  constructor(private readonly sharedEquipmentService: SharedEquipmentService) {}

  @Post()
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
  async listActivities(@Param('groupId') groupId: string) {
    return this.sharedEquipmentService.listActivities(groupId);
  }

  @Get(':activityId')
  @ApiOperation({ summary: 'Get activity with shared items' })
  async getActivity(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
  ) {
    return this.sharedEquipmentService.getActivity(groupId, activityId);
  }
}
