import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma.service';
import { OpenMeteoClient } from './open-meteo.client';
import { WeatherRulesService } from './weather-rules.service';
import { WeatherService } from './weather.service';

describe('WeatherService', () => {
  let service: WeatherService;
  const prisma = {
    groupActivity: { findUnique: jest.fn(), findMany: jest.fn() },
    teamWeatherRulePreference: { findMany: jest.fn() },
    weatherSnapshot: { upsert: jest.fn(), findFirst: jest.fn() },
    weatherSuggestion: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };
  const client = { forecastAt: jest.fn() };
  const rules = { evaluate: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        WeatherService,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenMeteoClient, useValue: client },
        { provide: WeatherRulesService, useValue: rules },
      ],
    }).compile();
    service = module.get(WeatherService);
  });

  it('does not retrieve irrelevant forecasts for indoor events', async () => {
    prisma.groupActivity.findUnique.mockResolvedValue({
      id: 'event-1',
      groupId: 'group-1',
      environment: 'INDOOR',
    });

    await expect(service.refresh('group-1', 'event-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(client.forecastAt).not.toHaveBeenCalled();
  });

  it('does not repeat a dismissed rule until its threshold state changes', async () => {
    prisma.groupActivity.findUnique.mockResolvedValue({
      id: 'event-1',
      groupId: 'group-1',
      environment: 'OUTDOOR',
      date: new Date('2026-08-01T10:00:00Z'),
      latitude: 52.2,
      longitude: 21,
      surface: 'grass',
      group: { sportType: 'football' },
      sharedItems: [],
      weatherSnapshots: [
        { raw: { activeRuleKeys: ['rain-rain'] } },
      ],
    });
    client.forecastAt.mockResolvedValue({
      forecastTime: new Date('2026-08-01T10:00:00Z'),
      temperature: 12,
      apparentTemperature: 11,
      precipitation: 1,
      windSpeed: 10,
      uvIndex: 2,
      raw: {},
    });
    rules.evaluate.mockReturnValue([
      {
        ruleKey: 'rain-rain',
        itemName: 'Towel',
        reason: 'Rain is forecast',
        quantity: 1,
        target: 'PERSONAL',
      },
    ]);
    prisma.teamWeatherRulePreference.findMany.mockResolvedValue([]);
    prisma.weatherSnapshot.upsert.mockResolvedValue({
      id: 'snapshot-2',
      fetchedAt: new Date(),
      source: 'Open-Meteo',
    });
    prisma.weatherSuggestion.findMany.mockResolvedValue([
      { ruleKey: 'rain-rain', status: 'DISMISSED' },
    ]);

    const result = await service.refresh('group-1', 'event-1');

    expect(result.suggestions).toEqual([]);
    expect(prisma.weatherSuggestion.create).not.toHaveBeenCalled();
  });
});
