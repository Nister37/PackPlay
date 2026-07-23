import { Injectable, ServiceUnavailableException } from '@nestjs/common';

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  precipitation: number[];
  wind_speed_10m: number[];
  uv_index: number[];
}

interface OpenMeteoResponse {
  hourly?: OpenMeteoHourly;
}

export interface EventForecast {
  forecastTime: Date;
  temperature: number;
  apparentTemperature: number;
  precipitation: number;
  windSpeed: number;
  uvIndex: number;
  raw: Record<string, number | string>;
}

@Injectable()
export class OpenMeteoClient {
  async forecastAt(
    latitude: number,
    longitude: number,
    eventTime: Date,
  ): Promise<EventForecast> {
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      hourly:
        'temperature_2m,apparent_temperature,precipitation,wind_speed_10m,uv_index',
      timezone: 'UTC',
      forecast_days: '16',
    });
    let response: Response;
    try {
      response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException('Weather forecast provider is unavailable');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('Weather forecast provider returned an error');
    }
    const payload = (await response.json()) as OpenMeteoResponse;
    const hourly = payload.hourly;
    if (!hourly?.time?.length) {
      throw new ServiceUnavailableException('Weather forecast data is unavailable');
    }
    const target = eventTime.getTime();
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    hourly.time.forEach((value, index) => {
      const distance = Math.abs(new Date(`${value}Z`).getTime() - target);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = index;
      }
    });
    if (nearestDistance > 90 * 60_000) {
      throw new ServiceUnavailableException('No hourly forecast covers the event time');
    }
    const forecastTime = new Date(`${hourly.time[nearest]}Z`);
    const result = {
      forecastTime,
      temperature: hourly.temperature_2m[nearest],
      apparentTemperature: hourly.apparent_temperature[nearest],
      precipitation: hourly.precipitation[nearest],
      windSpeed: hourly.wind_speed_10m[nearest],
      uvIndex: hourly.uv_index[nearest],
    };
    if (Object.values(result).some((value) => value === null || value === undefined)) {
      throw new ServiceUnavailableException('Hourly forecast is incomplete');
    }
    return {
      ...result,
      raw: {
        forecastTime: forecastTime.toISOString(),
        temperature: result.temperature,
        apparentTemperature: result.apparentTemperature,
        precipitation: result.precipitation,
        windSpeed: result.windSpeed,
        uvIndex: result.uvIndex,
      },
    };
  }
}
