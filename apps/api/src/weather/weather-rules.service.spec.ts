import { Test } from '@nestjs/testing';
import { WeatherRulesService } from './weather-rules.service';

describe('WeatherRulesService', () => {
  let service: WeatherRulesService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [WeatherRulesService],
    }).compile();
    service = module.get(WeatherRulesService);
  });

  it('creates transparent suggestions for rain, cold, UV, and wind', () => {
    const results = service.evaluate(
      {
        forecastTime: new Date(),
        temperature: 4,
        apparentTemperature: 2,
        precipitation: 2,
        windSpeed: 35,
        uvIndex: 7,
        raw: {},
      },
      { sport: 'football', surface: 'grass' },
    );

    expect(results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleKey: 'rain-rain', itemName: 'Towel' }),
        expect.objectContaining({ ruleKey: 'cold', itemName: 'Warm layer' }),
        expect.objectContaining({ ruleKey: 'uv-high', itemName: 'Sunscreen' }),
        expect.objectContaining({
          ruleKey: 'wind-field',
          itemName: 'Ground anchors',
        }),
      ]),
    );
    expect(results.every((result) => result.reason.length > 0)).toBe(true);
  });

  it('does not suggest weather equipment below all thresholds', () => {
    const results = service.evaluate(
      {
        forecastTime: new Date(),
        temperature: 18,
        apparentTemperature: 18,
        precipitation: 0,
        windSpeed: 10,
        uvIndex: 2,
        raw: {},
      },
      { sport: 'tennis', surface: 'clay' },
    );

    expect(results).toEqual([]);
  });
});
