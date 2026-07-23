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
import { GroupMemberRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';
import { Roles } from '../groups/decorators';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import {
  CreateEventFromTemplateDto,
  CreateTemplateFromEventDto,
} from './dto';
import { PreparationTemplatesService } from './preparation-templates.service';

@ApiTags('Preparation Templates')
@ApiBearerAuth()
@Controller('groups/:groupId/preparation-templates')
@UseGuards(JwtAuthGuard, GroupMemberGuard)
export class PreparationTemplatesController {
  constructor(private readonly templates: PreparationTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List reusable preparation templates' })
  list(@Param('groupId') groupId: string) {
    return this.templates.list(groupId);
  }

  @Get(':templateId')
  @ApiOperation({ summary: 'Get all versions of a preparation template' })
  get(
    @Param('groupId') groupId: string,
    @Param('templateId') templateId: string,
  ) {
    return this.templates.getTemplate(groupId, templateId);
  }

  @Post('from-events/:activityId')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Create a preparation template from an event' })
  createFromEvent(
    @Param('groupId') groupId: string,
    @Param('activityId') activityId: string,
    @Req() req: any,
    @Body() dto: CreateTemplateFromEventDto,
  ) {
    return this.templates.createFromEvent(groupId, activityId, req.user.id, dto);
  }

  @Post(':templateId/versions/from-events/:activityId')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Save an event as a new template version' })
  addVersion(
    @Param('groupId') groupId: string,
    @Param('templateId') templateId: string,
    @Param('activityId') activityId: string,
    @Req() req: any,
  ) {
    return this.templates.addVersion(groupId, templateId, activityId, req.user.id);
  }

  @Post(':templateId/events')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Create an independent event from a template version' })
  createEvent(
    @Param('groupId') groupId: string,
    @Param('templateId') templateId: string,
    @Req() req: any,
    @Body() dto: CreateEventFromTemplateDto,
  ) {
    return this.templates.createEvent(groupId, templateId, req.user.id, dto);
  }
}
