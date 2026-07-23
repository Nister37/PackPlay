import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { GroupsModule } from './groups/groups.module';
import { InvitationsModule } from './invitations/invitations.module';
import { SportProfilesModule } from './sport-profiles/sport-profiles.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { EquipmentItemsModule } from './equipment-items/equipment-items.module';
import { SharedEquipmentModule } from './shared-equipment/shared-equipment.module';
import { PackingSessionsModule } from './packing-sessions/packing-sessions.module';
import { ReadinessModule } from './readiness/readiness.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RealtimeModule } from './realtime/realtime.module';
import { LoggingInterceptor } from './common/logging.interceptor';
import { EventPlanningModule } from './event-planning/event-planning.module';
import { CalendarImportsModule } from './calendar-imports/calendar-imports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ScheduleModule.forRoot(),
    CommonModule,
    HealthModule,
    AuthModule,
    GroupsModule,
    InvitationsModule,
    SportProfilesModule,
    ChecklistsModule,
    EquipmentItemsModule,
    SharedEquipmentModule,
    PackingSessionsModule,
    ReadinessModule,
    NotificationsModule,
    RealtimeModule,
    EventPlanningModule,
    CalendarImportsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
