export interface WeatherCondition {
  temperatureC: number;
  precipitationProbability: number;
  windSpeedKmh: number;
  weatherCode: number;
  description: string;
  icon?: string;
  isPrecipitating: boolean;
  isHighWind: boolean;
  isExtremeCold: boolean;
  isExtremeHeat: boolean;
}

export interface WeatherSuggestion {
  id: string;
  activityId: string;
  equipmentName: string;
  category?: string | null;
  quantity: number;
  reason: string;
  status: 'PENDING' | 'ACCEPTED' | 'DISMISSED';
}

export interface ActivityWeatherSnapshot {
  activityId: string;
  forecastAvailable: boolean;
  lastUpdated: string;
  weather?: WeatherCondition | null;
  suggestions?: WeatherSuggestion[];
}
