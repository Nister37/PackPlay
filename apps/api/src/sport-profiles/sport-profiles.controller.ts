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
import { SportProfilesService } from './sport-profiles.service';
import { CreateSportProfileDto, UpdateSportProfileDto } from './dto';

@ApiTags('Sport Profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sport-profiles')
export class SportProfilesController {
  constructor(private readonly sportProfilesService: SportProfilesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a sport profile' })
  async create(@Req() req: any, @Body() dto: CreateSportProfileDto) {
    return this.sportProfilesService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "List user's sport profiles" })
  async list(@Req() req: any) {
    return this.sportProfilesService.listByUser(req.user.id);
  }

  @Get(':profileId')
  @ApiOperation({ summary: 'Get sport profile details' })
  async getOne(@Param('profileId') profileId: string, @Req() req: any) {
    return this.sportProfilesService.getById(profileId, req.user.id);
  }

  @Patch(':profileId')
  @ApiOperation({ summary: 'Update a sport profile' })
  async update(
    @Param('profileId') profileId: string,
    @Req() req: any,
    @Body() dto: UpdateSportProfileDto,
  ) {
    return this.sportProfilesService.update(profileId, req.user.id, dto);
  }

  @Delete(':profileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a sport profile and its checklists' })
  async delete(@Param('profileId') profileId: string, @Req() req: any) {
    return this.sportProfilesService.delete(profileId, req.user.id);
  }
}
