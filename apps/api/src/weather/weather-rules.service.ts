import { Injectable } from '@nestjs/common';
import { WeatherSuggestionTarget } from '@prisma/client';
import { EventForecast } from './open-meteo.client';

export interface WeatherRuleResult {
  ruleKey: string;
  itemName: string;
  reason: string;
  quantity: number;
  target: WeatherSuggestionTarget;
}

@Injectable()
export class WeatherRulesService {
  evaluate(
    forecast: EventForecast,
    context: { sport: string; surface: string | null },
  ): WeatherRuleResult[] {
    const results: WeatherRuleResult[] = [];
    if (forecast.precipitation >= 0.5) {
      const severity = forecast.precipitation >= 5 ? 'heavy' : 'rain';
      results.push({
        ruleKey: `rain-${severity}`,
        itemName: 'Towel',
        reason: `${severity === 'heavy' ? 'Heavy rain' : 'Rain'} is forecast (${forecast.precipitation.toFixed(1)} mm)`,
        quantity: 1,
        target: WeatherSuggestionTarget.PERSONAL,
      });
      results.push({
        ruleKey: `rain-cover-${severity}`,
        itemName: 'Waterproof equipment cover',
        reason: `Protect shared equipment from ${severity === 'heavy' ? 'heavy rain' : 'rain'}`,
        quantity: 1,
        target: WeatherSuggestionTarget.SHARED,
      });
    }
    if (forecast.apparentTemperature <= 5) {
      results.push({
        ruleKey: forecast.apparentTemperature <= 0 ? 'cold-freezing' : 'cold',
        itemName: 'Warm layer',
        reason: `Apparent temperature is ${forecast.apparentTemperature.toFixed(1)} °C`,
        quantity: 1,
        target: WeatherSuggestionTarget.PERSONAL,
      });
    }
    if (forecast.apparentTemperature >= 28) {
      results.push({
        ruleKey: forecast.apparentTemperature >= 35 ? 'heat-extreme' : 'heat',
        itemName: 'Extra water',
        reason: `Apparent temperature is ${forecast.apparentTemperature.toFixed(1)} °C`,
        quantity: forecast.apparentTemperature >= 35 ? 2 : 1,
        target: WeatherSuggestionTarget.PERSONAL,
      });
    }
    if (forecast.uvIndex >= 6) {
      results.push({
        ruleKey: forecast.uvIndex >= 8 ? 'uv-very-high' : 'uv-high',
        itemName: 'Sunscreen',
        reason: `UV index is ${forecast.uvIndex.toFixed(1)}`,
        quantity: 1,
        target: WeatherSuggestionTarget.PERSONAL,
      });
    }
    if (forecast.windSpeed >= 30) {
      const exposedSurface =
        context.surface?.toLocaleLowerCase().includes('grass') ||
        context.surface?.toLocaleLowerCase().includes('turf');
      results.push({
        ruleKey: exposedSurface ? 'wind-field' : 'wind',
        itemName: exposedSurface ? 'Ground anchors' : 'Equipment weights',
        reason: `${forecast.windSpeed.toFixed(0)} km/h wind affects ${context.sport} on ${context.surface ?? 'the selected surface'}`,
        quantity: 4,
        target: WeatherSuggestionTarget.SHARED,
      });
    }
    return results;
  }
}
