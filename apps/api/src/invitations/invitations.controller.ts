import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import { Roles } from '../groups/decorators';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto';

@ApiTags('Invitations')
@Controller()
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post('groups/:groupId/invitations')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, GroupMemberGuard, GroupRoleGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create an invitation link (OWNER/ADMIN)' })
  async createInvitation(
    @Param('groupId') groupId: string,
    @Req() req: any,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.createInvitation(groupId, req.user.id, dto);
  }

  @Post('groups/:groupId/invitations/regenerate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, GroupMemberGuard, GroupRoleGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Revoke active invitations and create a replacement' })
  async regenerateInvitation(
    @Param('groupId') groupId: string,
    @Req() req: any,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitationsService.regenerateInvitation(groupId, req.user.id, dto);
  }

  @Get('invitations/:token/info')
  @ApiOperation({ summary: 'Preview invitation info before joining' })
  async getInvitationInfo(@Param('token') token: string) {
    return this.invitationsService.getInvitationInfo(token);
  }

  @Post('invitations/:token/join')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Join a group via invitation token' })
  async joinGroup(@Param('token') token: string, @Req() req: any) {
    return this.invitationsService.joinGroup(token, req.user.id);
  }

  @Delete('groups/:groupId/invitations/:invitationId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, GroupMemberGuard, GroupRoleGuard)
  @Roles('OWNER', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an invitation (OWNER/ADMIN)' })
  async revokeInvitation(
    @Param('groupId') groupId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.invitationsService.revokeInvitation(groupId, invitationId);
  }

  @Get('groups/:groupId/invitations/:invitationId/qr')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, GroupMemberGuard, GroupRoleGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Generate QR code for an invitation (OWNER/ADMIN)' })
  @ApiProduces('image/png')
  async getInvitationQr(
    @Param('groupId') groupId: string,
    @Param('invitationId') invitationId: string,
    @Res() res: Response,
  ) {
    const token = await this.invitationsService.getInvitationForQr(groupId, invitationId);
    const buffer = await this.invitationsService.generateQrBuffer(token);
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': buffer.length,
      'Cache-Control': 'no-store',
    });
    res.send(buffer);
  }

  @Get('groups/:groupId/invitations')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, GroupMemberGuard, GroupRoleGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'List active invitations (OWNER/ADMIN)' })
  async listInvitations(@Param('groupId') groupId: string) {
    return this.invitationsService.listActiveInvitations(groupId);
  }
}
