import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OpenMeteoClient } from './open-meteo.client';

describe('OpenMeteoClient', () => {
  let client: OpenMeteoClient;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [OpenMeteoClient],
    }).compile();
    client = module.get(OpenMeteoClient);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns forecast data for the nearest hour to event time', async () => {
    const eventTime = new Date('2026-08-01T10:00:00Z');
    const mockResponse = {
      hourly: {
        time: ['2026-08-01T09:00', '2026-08-01T10:00', '2026-08-01T11:00'],
        temperature_2m: [18, 20, 22],
        apparent_temperature: [17, 19, 21],
        precipitation: [0, 0.5, 1.2],
        wind_speed_10m: [5, 8, 12],
        uv_index: [3, 5, 6],
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await client.forecastAt(52.2, 21.0, eventTime);

    expect(result.forecastTime).toEqual(new Date('2026-08-01T10:00:00Z'));
    expect(result.temperature).toBe(20);
    expect(result.apparentTemperature).toBe(19);
    expect(result.precipitation).toBe(0.5);
    expect(result.windSpeed).toBe(8);
    expect(result.uvIndex).toBe(5);
    expect(result.raw).toBeDefined();
  });

  it('throws ServiceUnavailableException when fetch fails (network error)', async () => {
    const eventTime = new Date('2026-08-01T10:00:00Z');
    global.fetch = jest.fn().mockRejectedValue(new Error('Network timeout'));

    await expect(
      client.forecastAt(52.2, 21.0, eventTime),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('throws ServiceUnavailableException when API returns non-OK status', async () => {
    const eventTime = new Date('2026-08-01T10:00:00Z');
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await expect(
      client.forecastAt(52.2, 21.0, eventTime),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('throws ServiceUnavailableException when hourly data is empty', async () => {
    const eventTime = new Date('2026-08-01T10:00:00Z');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hourly: { time: [] } }),
    });

    await expect(
      client.forecastAt(52.2, 21.0, eventTime),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('throws ServiceUnavailableException when event time is too far from available forecast', async () => {
    // Only have data for August 20, but event is September 1 (more than 90 minutes away from any hour)
    const eventTime = new Date('2026-09-01T10:00:00Z');
    const mockResponse = {
      hourly: {
        time: ['2026-08-20T10:00', '2026-08-20T11:00'],
        temperature_2m: [20, 22],
        apparent_temperature: [19, 21],
        precipitation: [0, 0],
        wind_speed_10m: [5, 8],
        uv_index: [3, 5],
      },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    await expect(
      client.forecastAt(52.2, 21.0, eventTime),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('selects the nearest available hour when event is between hours', async () => {
    const eventTime = new Date('2026-08-01T10:20:00Z');
    const mockResponse = {
      hourly: {
        time: ['2026-08-01T09:00', '2026-08-01T10:00', '2026-08-01T11:00'],
        temperature_2m: [18, 20, 22],
        apparent_temperature: [17, 19, 21],
        precipitation: [0, 0.5, 1.2],
        wind_speed_10m: [5, 8, 12],
        uv_index: [3, 5, 6],
      },
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await client.forecastAt(52.2, 21.0, eventTime);

    // 10:20 is closest to 10:00 (20 min away) vs 11:00 (40 min away)
    expect(result.forecastTime).toEqual(new Date('2026-08-01T10:00:00Z'));
    expect(result.temperature).toBe(20);
  });
});
