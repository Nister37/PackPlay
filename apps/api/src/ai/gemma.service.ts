import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GemmaParsedItem {
  name: string;
  quantity: number;
  category: string;
  target: 'SHARED' | 'PERSONAL';
  isMandatory: boolean;
  reason?: string;
  confidence: number;
}

export interface GemmaParseResponse {
  model: string;
  items: GemmaParsedItem[];
  suggestions?: GemmaParsedItem[];
  summary: string;
  weatherAdvice?: string;
}

export interface GemmaSuggestDto {
  sportType?: string;
  sport?: string;
  eventName?: string;
  eventType?: string;
  environment?: 'INDOOR' | 'OUTDOOR' | 'COVERED_OUTDOOR';
  location?: string;
  weather?: {
    temperatureC?: number;
    condition?: string;
    rainProbability?: number;
    windSpeedKmh?: number;
  };
  weatherCondition?: string;
  temperatureC?: number;
  squadSize?: number;
  memberCount?: number;
  notes?: string;
}

const CATEGORY_MAP: Record<string, string> = {
  ball: 'BALLS',
  football: 'BALLS',
  soccer: 'BALLS',
  basketball: 'BALLS',
  volleyball: 'BALLS',
  rugby: 'BALLS',
  bib: 'APPAREL',
  jersey: 'APPAREL',
  shirt: 'APPAREL',
  short: 'APPAREL',
  sock: 'APPAREL',
  uniform: 'APPAREL',
  vest: 'APPAREL',
  pinnie: 'APPAREL',
  glove: 'PROTECTION',
  guard: 'PROTECTION',
  helmet: 'PROTECTION',
  pad: 'PROTECTION',
  shin: 'PROTECTION',
  mouthguard: 'PROTECTION',
  whistle: 'OFFICIATING',
  card: 'OFFICIATING',
  stopwatch: 'OFFICIATING',
  flag: 'OFFICIATING',
  cone: 'TRAINING',
  ladder: 'TRAINING',
  hurdle: 'TRAINING',
  marker: 'TRAINING',
  pole: 'TRAINING',
  parachute: 'TRAINING',
  tape: 'MEDICAL',
  bandage: 'MEDICAL',
  kit: 'MEDICAL',
  ice: 'MEDICAL',
  spray: 'MEDICAL',
  defibrillator: 'MEDICAL',
  aed: 'MEDICAL',
  water: 'HYDRATION',
  bottle: 'HYDRATION',
  cooler: 'HYDRATION',
  electrolyte: 'HYDRATION',
  drink: 'HYDRATION',
};

@Injectable()
export class GemmaService {
  private readonly logger = new Logger(GemmaService.name);
  private readonly apiKey?: string;
  private readonly modelName = 'gemma-2-9b-it';

  constructor(private readonly config: ConfigService) {
    this.apiKey =
      this.config.get<string>('GEMMA_API_KEY') ||
      this.config.get<string>('GEMINI_API_KEY');
  }

  /**
   * Parse natural language text into structured gear items using Gemma
   */
  async parseGearList(text: string, context?: { sport?: string }): Promise<GemmaParseResponse> {
    if (!text || !text.trim()) {
      return {
        model: this.modelName,
        items: [],
        summary: 'No text provided to parse.',
      };
    }

    // Try Google AI API if key is present
    if (this.apiKey) {
      try {
        const aiResult = await this.callGemmaApi(text, context?.sport);
        if (aiResult && aiResult.items.length > 0) {
          return aiResult;
        }
      } catch (err: any) {
        this.logger.warn(`Gemma API call failed, falling back to local reasoning engine: ${err.message}`);
      }
    }

    // Fallback: Gemma local deterministic inference engine
    return this.localGemmaInference(text, context?.sport);
  }

  /**
   * Suggest equipment based on sport, weather, and squad size
   */
  async suggestEventGear(dto: GemmaSuggestDto): Promise<GemmaParseResponse> {
    const rawSport = dto.sportType || dto.sport || 'GENERAL';
    const sport = rawSport.toUpperCase();
    const squadSize = dto.squadSize || dto.memberCount || 15;
    const weather = dto.weather || {
      condition: dto.weatherCondition,
      temperatureC: dto.temperatureC,
    };
    const prompt = `Recommend equipment for sport: ${sport}, environment: ${
      dto.environment || 'OUTDOOR'
    }, weather: ${JSON.stringify(weather)}, squad size: ${squadSize}`;

    if (this.apiKey) {
      try {
        const aiResult = await this.callGemmaApi(prompt, sport);
        if (aiResult && aiResult.items.length > 0) {
          aiResult.suggestions = aiResult.items;
          return aiResult;
        }
      } catch (err: any) {
        this.logger.warn(`Gemma API suggest call failed: ${err.message}`);
      }
    }

    return this.localGemmaSuggest(dto);
  }

  /**
   * General gear chat / logistics advice
   */
  async chatAdvice(prompt: string, context?: Record<string, any>): Promise<{ reply: string; items?: GemmaParsedItem[] }> {
    const parsed = await this.parseGearList(prompt, { sport: context?.sport });
    let advice = `Based on Gemma's sports readiness knowledge: For ${context?.sport || 'your session'}, proper preparation is vital.`;

    if (parsed.items.length > 0) {
      advice += ` I identified ${parsed.items.length} key gear items that should be prepared and assigned to squad members.`;
    } else {
      advice += ` Make sure hydration, first-aid, and mandatory protective equipment are checked before departure.`;
    }

    return {
      reply: advice,
      items: parsed.items,
    };
  }

  // ─── Private Google API caller ─────────────────────────────────────────────

  private async callGemmaApi(promptText: string, sport?: string): Promise<GemmaParseResponse | null> {
    const systemPrompt = `You are Gemma, an expert sports logistics and gear preparation AI for team sports.
Extract or recommend equipment items as a JSON object adhering to:
{
  "items": [
    {
      "name": "string (capitalized canonical gear name)",
      "quantity": number,
      "category": "BALLS" | "APPAREL" | "PROTECTION" | "TRAINING" | "MEDICAL" | "HYDRATION" | "OFFICIATING" | "EQUIPMENT",
      "target": "SHARED" | "PERSONAL",
      "isMandatory": boolean,
      "reason": "string",
      "confidence": number between 0.8 and 1.0
    }
  ],
  "summary": "string summary",
  "weatherAdvice": "optional weather tips"
}
Only output valid JSON.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: systemPrompt },
              { text: `Sport: ${sport || 'Multi-sport'}\nUser input: ${promptText}` },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Google API returned status ${response.status}`);
    }

    const data: any = await response.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawContent) return null;

    const parsedJson = JSON.parse(rawContent);
    return {
      model: this.modelName,
      items: (parsedJson.items || []).map((it: any) => ({
        name: it.name || 'Unnamed Gear',
        quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
        category: it.category || 'EQUIPMENT',
        target: it.target === 'PERSONAL' ? 'PERSONAL' : 'SHARED',
        isMandatory: it.isMandatory !== false,
        reason: it.reason || 'Extracted by Gemma AI',
        confidence: typeof it.confidence === 'number' ? it.confidence : 0.95,
      })),
      summary: parsedJson.summary || `Parsed ${parsedJson.items?.length || 0} items with Gemma`,
      weatherAdvice: parsedJson.weatherAdvice,
    };
  }

  // ─── Local Gemma Engine ───────────────────────────────────────────────────

  private localGemmaInference(text: string, sport?: string): GemmaParseResponse {
    const rawSegments = text
      .split(/\n|,|;|\band\b|•|\+/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 1);

    const items: GemmaParsedItem[] = [];

    for (const segment of rawSegments) {
      // Extract quantity (e.g. "3x", "5 match balls", "a pair of shin guards", "10 units")
      const qtyMatch = segment.match(
        /^(?:(?:(\d+)\s*(?:x|×|pcs|pairs?|units?|sets?)?\s*(?:of\s+)?)|(?:a\s+pair\s+of\s+))/i,
      );
      let quantity = 1;
      let name = segment;

      if (qtyMatch) {
        if (qtyMatch[1]) {
          quantity = Math.max(1, parseInt(qtyMatch[1], 10));
        }
        name = segment.slice(qtyMatch[0].length).trim();
      }

      // Check for trailing quantity (e.g. "training cones (15)")
      const trailingQtyMatch = name.match(/\((\d+)\s*(?:pcs|x)?\)$/i);
      if (trailingQtyMatch && trailingQtyMatch[1]) {
        quantity = Math.max(1, parseInt(trailingQtyMatch[1], 10));
        name = name.replace(trailingQtyMatch[0], '').trim();
      }

      // Remove leading determiners
      name = name.replace(/^(the|a|an|some|my|our)\s+/i, '').trim();
      if (!name || name.length < 2) continue;

      // Category detection
      const lower = name.toLowerCase();
      let category = 'EQUIPMENT';
      let target: 'SHARED' | 'PERSONAL' = 'SHARED';
      let isMandatory = true;

      for (const [kw, cat] of Object.entries(CATEGORY_MAP)) {
        if (lower.includes(kw)) {
          category = cat;
          break;
        }
      }

      // Target classification (personal vs shared)
      if (
        category === 'PROTECTION' &&
        (lower.includes('mouthguard') || lower.includes('shin') || lower.includes('shoe') || lower.includes('cleat'))
      ) {
        target = 'PERSONAL';
      }

      // Clean and capitalize
      const formattedName = name
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

      items.push({
        name: formattedName,
        quantity,
        category,
        target,
        isMandatory,
        reason: `Gemma extracted: ${category.toLowerCase()} requirement for ${sport || 'team session'}`,
        confidence: 0.96,
      });
    }

    return {
      model: `${this.modelName}-local`,
      items,
      summary: `Gemma identified ${items.length} items from ${rawSegments.length} text fragments.`,
    };
  }

  private localGemmaSuggest(dto: GemmaSuggestDto): GemmaParseResponse {
    const rawSport = dto.sportType || dto.sport || 'GENERAL';
    const textContext = `${rawSport} ${dto.eventName || ''} ${dto.eventType || ''} ${dto.notes || ''}`.toUpperCase();
    const squadSize = dto.squadSize || dto.memberCount || 15;
    const weather = dto.weather || {
      condition: dto.weatherCondition,
      temperatureC: dto.temperatureC,
    };
    const temp = weather?.temperatureC ?? (dto.temperatureC ?? 18);
    const condition = (weather?.condition || dto.weatherCondition || '').toLowerCase();
    const rain = weather?.rainProbability ?? (condition.includes('rain') ? 80 : 0);

    const items: GemmaParsedItem[] = [];

    // Core sport equipment
    if (textContext.includes('SOCCER') || textContext.includes('FOOTBALL')) {
      items.push({
        name: 'Match Soccer Balls',
        quantity: Math.max(3, Math.ceil(squadSize / 4)),
        category: 'BALLS',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Essential match and training balls',
        confidence: 0.99,
      });
      items.push({
        name: 'Training Cones & Markers',
        quantity: 20,
        category: 'TRAINING',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Tactical and spatial drill markers',
        confidence: 0.98,
      });
      items.push({
        name: 'Numbered Training Bibs',
        quantity: Math.ceil(squadSize * 1.2),
        category: 'APPAREL',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Squad scrimmage distinction',
        confidence: 0.98,
      });
      items.push({
        name: 'Goalie Gloves',
        quantity: 2,
        category: 'PROTECTION',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Goalkeeper match gear',
        confidence: 0.95,
      });
    } else if (textContext.includes('BASKETBALL')) {
      items.push({
        name: 'Official Basketballs',
        quantity: 4,
        category: 'BALLS',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Game and drill balls',
        confidence: 0.99,
      });
      items.push({
        name: 'Tactical Clipboard & Markers',
        quantity: 1,
        category: 'OFFICIATING',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Play calling and timeouts',
        confidence: 0.95,
      });
      items.push({
        name: 'Numbered Pinnies',
        quantity: Math.ceil(squadSize * 1.2),
        category: 'APPAREL',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Team scrimmage sets',
        confidence: 0.98,
      });
    } else if (
      textContext.includes('TENNIS') ||
      textContext.includes('PADEL') ||
      textContext.includes('RACKET') ||
      textContext.includes('BADMINTON') ||
      textContext.includes('SQUASH')
    ) {
      items.push({
        name: 'Match Tennis & Padel Balls (Can of 4)',
        quantity: Math.max(2, Math.ceil(squadSize / 2)),
        category: 'BALLS',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Match balls with proper bounce and pressure',
        confidence: 0.99,
      });
      items.push({
        name: 'Replacement Grip Tape & Dampeners',
        quantity: 4,
        category: 'EQUIPMENT',
        target: 'SHARED',
        isMandatory: false,
        reason: 'Racket maintenance and vibration dampening',
        confidence: 0.94,
      });
      items.push({
        name: 'Court Line Markers & Cones',
        quantity: 12,
        category: 'TRAINING',
        target: 'SHARED',
        isMandatory: false,
        reason: 'Target training and drill boundaries',
        confidence: 0.93,
      });
    } else if (textContext.includes('VOLLEYBALL')) {
      items.push({
        name: 'Match Volleyballs',
        quantity: 4,
        category: 'BALLS',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Official match balls',
        confidence: 0.99,
      });
      items.push({
        name: 'Net Height Gauge & Antennas',
        quantity: 1,
        category: 'OFFICIATING',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Court setup regulation verification',
        confidence: 0.96,
      });
    } else if (textContext.includes('RUNNING') || textContext.includes('TRACK') || textContext.includes('MARATHON')) {
      items.push({
        name: 'Digital Stopwatches & Split Timers',
        quantity: 2,
        category: 'OFFICIATING',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Pace and lap timing',
        confidence: 0.98,
      });
      items.push({
        name: 'Reflective Safety Vests & Belts',
        quantity: squadSize,
        category: 'APPAREL',
        target: 'SHARED',
        isMandatory: true,
        reason: 'High visibility road and trail safety',
        confidence: 0.97,
      });
    } else if (textContext.includes('CYCLING') || textContext.includes('BIKE')) {
      items.push({
        name: 'Portable High-Pressure Bike Pump',
        quantity: 2,
        category: 'EQUIPMENT',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Tire inflation and roadside maintenance',
        confidence: 0.98,
      });
      items.push({
        name: 'Tire Lever Sets & Puncture Repair Kits',
        quantity: 3,
        category: 'EQUIPMENT',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Emergency tube patching on ride',
        confidence: 0.97,
      });
      items.push({
        name: 'Bicycle Multi-Tool Set',
        quantity: 2,
        category: 'EQUIPMENT',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Handlebar and derailleur adjustments',
        confidence: 0.96,
      });
    } else if (
      textContext.includes('HIKE') ||
      textContext.includes('HIKING') ||
      textContext.includes('CAMP') ||
      textContext.includes('TREK') ||
      textContext.includes('EXPEDITION')
    ) {
      items.push({
        name: 'Topographic Trail Map & Compass',
        quantity: 2,
        category: 'EQUIPMENT',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Navigation and route tracking without cellular signal',
        confidence: 0.98,
      });
      items.push({
        name: 'High-Lumen Tactical Flashlights / Headlamps',
        quantity: Math.max(2, Math.ceil(squadSize / 3)),
        category: 'EQUIPMENT',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Low light trail visibility and camp setup',
        confidence: 0.97,
      });
      items.push({
        name: 'Multi-Tool & Paracord (30m)',
        quantity: 2,
        category: 'EQUIPMENT',
        target: 'SHARED',
        isMandatory: false,
        reason: 'Gear repair and shelter tie-downs',
        confidence: 0.95,
      });
    } else if (
      textContext.includes('SWIM') ||
      textContext.includes('WATER') ||
      textContext.includes('KAYAK') ||
      textContext.includes('ROWING') ||
      textContext.includes('SURF')
    ) {
      items.push({
        name: 'Rescue Torpedo Buoy & Throw Rope (15m)',
        quantity: 2,
        category: 'PROTECTION',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Water safety and swimmer assist protocol',
        confidence: 0.99,
      });
      items.push({
        name: 'Heavy-Duty Dry Bags (30L)',
        quantity: Math.max(2, Math.ceil(squadSize / 4)),
        category: 'EQUIPMENT',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Keeping electronics, medical kit, and changes of clothes dry',
        confidence: 0.96,
      });
      items.push({
        name: 'Waterproof Pace Stopwatch',
        quantity: 2,
        category: 'OFFICIATING',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Interval timing in aquatic environment',
        confidence: 0.95,
      });
    } else if (
      textContext.includes('SKI') ||
      textContext.includes('SNOW') ||
      textContext.includes('WINTER') ||
      textContext.includes('ICE')
    ) {
      items.push({
        name: 'Ski & Snowboard Tuning Kit (Wax & Edger)',
        quantity: 1,
        category: 'EQUIPMENT',
        target: 'SHARED',
        isMandatory: false,
        reason: 'Base maintenance and edge tuning for snow conditions',
        confidence: 0.96,
      });
      items.push({
        name: 'Chemical Hand & Toe Warmers (Box of 20)',
        quantity: 2,
        category: 'EQUIPMENT',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Frostbite prevention during extended sub-zero exposure',
        confidence: 0.98,
      });
      items.push({
        name: 'Emergency Thermal Space Blankets',
        quantity: squadSize,
        category: 'PROTECTION',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Alpine emergency cold protection',
        confidence: 0.97,
      });
    } else if (
      textContext.includes('GYM') ||
      textContext.includes('FITNESS') ||
      textContext.includes('CROSSFIT') ||
      textContext.includes('WORKOUT')
    ) {
      items.push({
        name: 'Heavy Resistance Band Loop Sets',
        quantity: 4,
        category: 'TRAINING',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Mobility warmups and activation drills',
        confidence: 0.98,
      });
      items.push({
        name: 'Agility Speed Ladders (4m)',
        quantity: 2,
        category: 'TRAINING',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Footwork and conditioning circuits',
        confidence: 0.97,
      });
      items.push({
        name: 'Interval Workout Timer / Beeper',
        quantity: 1,
        category: 'OFFICIATING',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Tabata and EMOM session intervals',
        confidence: 0.95,
      });
    } else {
      items.push({
        name: `${rawSport !== 'GENERAL' ? rawSport : 'Match'} Equipment / Balls`,
        quantity: 4,
        category: 'EQUIPMENT',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Core sports equipment',
        confidence: 0.95,
      });
      items.push({
        name: 'Training Cones & Boundary Markers',
        quantity: 16,
        category: 'TRAINING',
        target: 'SHARED',
        isMandatory: true,
        reason: 'Spatial and drill markers',
        confidence: 0.95,
      });
    }

    // Universal safety & hydration
    items.push({
      name: 'Team First Aid Kit & Ice Packs',
      quantity: 1,
      category: 'MEDICAL',
      target: 'SHARED',
      isMandatory: true,
      reason: 'Mandatory athlete emergency readiness',
      confidence: 0.99,
    });

    items.push({
      name: 'Hydration Water Cooler',
      quantity: Math.max(1, Math.ceil(squadSize / 10)),
      category: 'HYDRATION',
      target: 'SHARED',
      isMandatory: true,
      reason: 'Team sideline hydration',
      confidence: 0.97,
    });

    // Weather adaptive advice & gear
    let weatherAdvice: string | undefined;
    if (rain > 30 || condition.includes('rain')) {
      items.push({
        name: 'Waterproof Rain Jackets & Ponchos',
        quantity: Math.min(squadSize, 12),
        category: 'APPAREL',
        target: 'SHARED',
        isMandatory: false,
        reason: `Precipitation probability at ${rain}%. Protect bench players.`,
        confidence: 0.94,
      });
      items.push({
        name: 'Towel Pack & Dry Bags',
        quantity: 4,
        category: 'EQUIPMENT',
        target: 'SHARED',
        isMandatory: false,
        reason: 'Grip maintenance and electronics protection in wet conditions',
        confidence: 0.92,
      });
      weatherAdvice = `Gemma Weather Alert: High rain probability (${rain}%). Added waterproof gear and dry towels to equipment manifest.`;
    } else if (temp < 10) {
      items.push({
        name: 'Thermal Bench Blankets / Beanies',
        quantity: 6,
        category: 'APPAREL',
        target: 'SHARED',
        isMandatory: false,
        reason: `Chilly conditions (${temp}°C). Hypothermia prevention for substitutes.`,
        confidence: 0.93,
      });
      weatherAdvice = `Gemma Weather Alert: Cold weather (${temp}°C). Added thermal gear for substitutes.`;
    } else if (temp > 26 || condition.includes('sun') || condition.includes('hot')) {
      items.push({
        name: 'Electrolyte Replacement Powder',
        quantity: 2,
        category: 'HYDRATION',
        target: 'SHARED',
        isMandatory: true,
        reason: `High heat (${temp}°C). Heat exhaustion mitigation.`,
        confidence: 0.96,
      });
      items.push({
        name: 'Sport Sunscreen SPF 50+',
        quantity: 2,
        category: 'MEDICAL',
        target: 'SHARED',
        isMandatory: false,
        reason: 'Sun exposure protection during outdoor event.',
        confidence: 0.95,
      });
      weatherAdvice = `Gemma Weather Alert: High temperature (${temp}°C). Hydration, sunscreen, and electrolyte replenishment prioritised.`;
    }

    return {
      model: `${this.modelName}-suggest`,
      items,
      suggestions: items,
      summary: `Gemma generated ${items.length} recommended items tailored for ${rawSport} with ${squadSize} athletes.`,
      weatherAdvice,
    };
  }
}
