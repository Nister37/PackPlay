import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { CatalogueQueryDto, UpdateSuggestionPreferenceDto } from './dto';
import { EquipmentCatalogueService } from './equipment-catalogue.service';

@ApiTags('Equipment Catalogue')
@ApiBearerAuth()
@Controller('equipment-catalogue')
@UseGuards(JwtAuthGuard)
export class EquipmentCatalogueController {
  constructor(private readonly catalogue: EquipmentCatalogueService) {}

  @Get('search')
  @ApiOperation({ summary: 'Rank exact, alias, prefix, and fuzzy equipment matches' })
  search(@Req() req: any, @Query() query: CatalogueQueryDto) {
    return this.catalogue.search(req.user.id, query);
  }

  @Get('bootstrap')
  @ApiOperation({ summary: 'Download deterministic catalogue data for local autocomplete' })
  bootstrap() {
    return this.catalogue.bootstrap();
  }

  @Get('preferences/me')
  preference(@Req() req: any) {
    return this.catalogue.getPreference(req.user.id);
  }

  @Patch('preferences/me')
  updatePreference(
    @Req() req: any,
    @Body() dto: UpdateSuggestionPreferenceDto,
  ) {
    return this.catalogue.updatePreference(req.user.id, dto);
  }

  @Delete('preferences/me/personalization')
  @ApiOperation({ summary: 'Disable and clear personalized ranking controls' })
  clear(@Req() req: any) {
    return this.catalogue.clearPersonalization(req.user.id);
  }
}
