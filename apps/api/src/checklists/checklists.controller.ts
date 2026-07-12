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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { ChecklistsService } from './checklists.service';
import { CreateChecklistDto, UpdateChecklistDto } from './dto';

@ApiTags('Checklists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('checklists')
export class ChecklistsController {
  constructor(private readonly checklistsService: ChecklistsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a checklist' })
  async create(@Req() req: any, @Body() dto: CreateChecklistDto) {
    return this.checklistsService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "List user's checklists" })
  @ApiQuery({ name: 'sportProfileId', required: false })
  @ApiQuery({ name: 'activityType', required: false })
  async list(
    @Req() req: any,
    @Query('sportProfileId') sportProfileId?: string,
    @Query('activityType') activityType?: string,
  ) {
    return this.checklistsService.listByUser(req.user.id, {
      sportProfileId,
      activityType,
    });
  }

  @Get(':checklistId')
  @ApiOperation({ summary: 'Get checklist with items' })
  async getOne(@Param('checklistId') checklistId: string, @Req() req: any) {
    return this.checklistsService.getById(checklistId, req.user.id);
  }

  @Patch(':checklistId')
  @ApiOperation({ summary: 'Update checklist metadata' })
  async update(
    @Param('checklistId') checklistId: string,
    @Req() req: any,
    @Body() dto: UpdateChecklistDto,
  ) {
    return this.checklistsService.update(checklistId, req.user.id, dto);
  }

  @Delete(':checklistId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a checklist' })
  async delete(@Param('checklistId') checklistId: string, @Req() req: any) {
    return this.checklistsService.delete(checklistId, req.user.id);
  }

  @Post(':checklistId/duplicate')
  @ApiOperation({ summary: 'Duplicate a checklist with all items' })
  async duplicate(@Param('checklistId') checklistId: string, @Req() req: any) {
    return this.checklistsService.duplicate(checklistId, req.user.id);
  }

  @Post(':checklistId/save-as-template')
  @ApiOperation({ summary: 'Mark a checklist as template' })
  async saveAsTemplate(@Param('checklistId') checklistId: string, @Req() req: any) {
    return this.checklistsService.saveAsTemplate(checklistId, req.user.id);
  }
}
