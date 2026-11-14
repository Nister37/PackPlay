import { ConfigService } from '@nestjs/config';
import { GemmaService } from './gemma.service';

describe('GemmaService', () => {
  let service: GemmaService;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    service = new GemmaService(configService);
  });

  it('parses natural language sports text into structured gear items with Gemma', async () => {
    const input = '5 soccer balls, 15 orange training bibs, 2 goalie gloves, 1 first aid kit, 20 water bottles';
    const result = await service.parseGearList(input, { sport: 'SOCCER' });

    expect(result.model).toContain('gemma-2-9b-it');
    expect(result.items.length).toBe(5);

    const balls = result.items.find((i) => i.name.toLowerCase().includes('ball'));
    expect(balls).toBeDefined();
    expect(balls?.quantity).toBe(5);
    expect(balls?.category).toBe('BALLS');
    expect(balls?.target).toBe('SHARED');

    const gloves = result.items.find((i) => i.name.toLowerCase().includes('glove'));
    expect(gloves).toBeDefined();
    expect(gloves?.quantity).toBe(2);
    expect(gloves?.category).toBe('PROTECTION');

    const kit = result.items.find((i) => i.name.toLowerCase().includes('kit'));
    expect(kit).toBeDefined();
    expect(kit?.category).toBe('MEDICAL');
  });

  it('suggests equipment manifest tailored to sport and weather conditions', async () => {
    const result = await service.suggestEventGear({
      sportType: 'SOCCER',
      eventName: 'Championship Match',
      environment: 'OUTDOOR',
      weather: {
        temperatureC: 6,
        rainProbability: 75,
      },
      squadSize: 18,
    });

    expect(result.items.length).toBeGreaterThanOrEqual(4);
    expect(result.suggestions).toEqual(result.items);
    expect(result.weatherAdvice).toBeDefined();
    expect(result.weatherAdvice).toContain('rain');

    // Should include rain gear due to 75% rain probability
    const rainGear = result.items.find((i) => i.name.toLowerCase().includes('rain') || i.name.toLowerCase().includes('towel'));
    expect(rainGear).toBeDefined();
  });

  it('supports alternative sport field and hot weather adaptations with suggestions alias', async () => {
    const result = await service.suggestEventGear({
      sport: 'Tennis',
      weatherCondition: 'sunny and hot',
      temperatureC: 32,
      memberCount: 8,
    });

    expect(result.items.length).toBeGreaterThanOrEqual(4);
    expect(result.suggestions).toEqual(result.items);

    const tennisBalls = result.items.find((i) => i.name.toLowerCase().includes('tennis'));
    expect(tennisBalls).toBeDefined();

    const sunscreen = result.items.find((i) => i.name.toLowerCase().includes('sunscreen'));
    expect(sunscreen).toBeDefined();
  });

  it('provides chat advice with equipment insights', async () => {
    const chatRes = await service.chatAdvice('Need help packing for weekend soccer match', { sport: 'SOCCER' });
    expect(chatRes.reply).toBeDefined();
    expect(chatRes.reply).toContain('Gemma');
    expect(chatRes.items).toBeDefined();
  });

  it('handles empty input gracefully', async () => {
    const result = await service.parseGearList('');
    expect(result.items).toEqual([]);
    expect(result.summary).toContain('No text');
  });
});
