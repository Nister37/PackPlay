import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards';
import { GemmaService, GemmaSuggestDto } from './gemma.service';

export class ParseGearDto {
  text!: string;
  sport?: string;
}

export class ChatAdviceDto {
  prompt?: string;
  message?: string;
  context?: Record<string, any>;
}

@ApiTags('Gemma AI')
@Controller(['ai/gemma', 'api/ai/gemma'])
export class GemmaController {
  constructor(private readonly gemmaService: GemmaService) {}

  @Post('parse')
  @ApiOperation({ summary: 'Parse unstructured sports text into gear items using Gemma' })
  async parseGearList(@Body() dto: ParseGearDto) {
    return this.gemmaService.parseGearList(dto.text, { sport: dto.sport });
  }

  @Post('suggest')
  @ApiOperation({ summary: 'Recommend event equipment using Gemma AI based on sport and weather' })
  async suggestEventGear(@Body() dto: GemmaSuggestDto) {
    return this.gemmaService.suggestEventGear(dto);
  }

  @Post('chat')
  @ApiOperation({ summary: 'Interactive sports logistics advice powered by Gemma' })
  async chatAdvice(@Body() dto: ChatAdviceDto) {
    const promptText = dto.prompt || dto.message || '';
    return this.gemmaService.chatAdvice(promptText, dto.context);
  }
}
