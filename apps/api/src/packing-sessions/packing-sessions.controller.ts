import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { PackingSessionsService } from './packing-sessions.service';
import { ListSessionsQueryDto, RecordDecisionDto, StartPackingSessionDto } from './dto';

@ApiTags('Packing Sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('packing-sessions')
export class PackingSessionsController {
  constructor(private readonly packingSessionsService: PackingSessionsService) {}

  @Post()
  @ApiOperation({ summary: 'Start a new packing session' })
  async startSession(@Req() req: any, @Body() dto: StartPackingSessionDto) {
    return this.packingSessionsService.startSession(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user packing sessions' })
  async listSessions(@Req() req: any, @Query() query: ListSessionsQueryDto) {
    return this.packingSessionsService.listSessions(req.user.id, query.status);
  }

  @Get(':sessionId')
  @ApiOperation({ summary: 'Get packing session details with decisions' })
  async getSession(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.packingSessionsService.getSession(req.user.id, sessionId);
  }

  @Post(':sessionId/decisions')
  @ApiOperation({ summary: 'Record a packing decision' })
  async recordDecision(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: RecordDecisionDto,
  ) {
    return this.packingSessionsService.recordDecision(req.user.id, sessionId, dto);
  }

  @Post(':sessionId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a packing session' })
  async completeSession(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.packingSessionsService.completeSession(req.user.id, sessionId);
  }

  @Post(':sessionId/abandon')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Abandon a packing session' })
  async abandonSession(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.packingSessionsService.abandonSession(req.user.id, sessionId);
  }

  @Get(':sessionId/remaining')
  @ApiOperation({ summary: 'Get remaining mandatory items for a session' })
  async getRemainingItems(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.packingSessionsService.getRemainingItems(req.user.id, sessionId);
  }
}
