import { Module } from '@nestjs/common';
import { GroupMemberGuard, GroupRoleGuard } from '../groups/guards';
import { OpenMeteoClient } from './open-meteo.client';
import { WeatherController } from './weather.controller';
import { WeatherRulesService } from './weather-rules.service';
import { WeatherService } from './weather.service';

@Module({
  controllers: [WeatherController],
  providers: [
    OpenMeteoClient,
    WeatherRulesService,
    WeatherService,
    GroupMemberGuard,
    GroupRoleGuard,
  ],
  exports: [WeatherService],
})
export class WeatherModule {}
