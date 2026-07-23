import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GroupMemberRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards';
import { Roles } from '../groups/decorators';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import { CalendarImportsService } from './calendar-imports.service';
import {
  ConnectCalendarFeedDto,
  ImportCalendarFileDto,
  PreviewCalendarFileDto,
  PreviewCalendarUrlDto,
} from './dto';

@ApiTags('Calendar imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, GroupMemberGuard)
@Controller('groups/:groupId/calendar-feeds')
export class CalendarImportsController {
  constructor(private readonly service: CalendarImportsService) {}

  @Post('preview-url')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Preview an HTTPS iCalendar feed without saving it' })
  previewUrl(@Body() dto: PreviewCalendarUrlDto) {
    return this.service.previewUrl(dto.url);
  }

  @Post('preview-file')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Preview uploaded iCalendar content without saving it' })
  previewFile(@Body() dto: PreviewCalendarFileDto) {
    return this.service.preview(dto.content);
  }

  @Post('import-file')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Import events from reviewed iCalendar content' })
  importFile(
    @Param('groupId') groupId: string,
    @Req() request: any,
    @Body() dto: ImportCalendarFileDto,
  ) {
    return this.service.importFile(groupId, request.user.id, dto.name, dto.content);
  }

  @Post()
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Connect and initially synchronize a calendar feed' })
  connect(
    @Param('groupId') groupId: string,
    @Req() request: any,
    @Body() dto: ConnectCalendarFeedDto,
  ) {
    return this.service.connect(groupId, request.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List calendar feeds without exposing their URLs' })
  list(@Param('groupId') groupId: string) {
    return this.service.listFeeds(groupId);
  }

  @Post(':feedId/sync')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Synchronize a connected calendar feed now' })
  sync(@Param('groupId') groupId: string, @Param('feedId') feedId: string) {
    return this.service.syncFeed(groupId, feedId);
  }

  @Delete(':feedId')
  @Roles(GroupMemberRole.OWNER, GroupMemberRole.ADMIN)
  @UseGuards(GroupRoleGuard)
  @ApiOperation({ summary: 'Disconnect a feed while retaining imported events' })
  disconnect(@Param('groupId') groupId: string, @Param('feedId') feedId: string) {
    return this.service.disconnect(groupId, feedId);
  }
}
