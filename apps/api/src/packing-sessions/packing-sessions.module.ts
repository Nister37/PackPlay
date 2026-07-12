import { Module, forwardRef } from '@nestjs/common';
import { PackingSessionsController } from './packing-sessions.controller';
import { PackingSessionsService } from './packing-sessions.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    forwardRef(() => NotificationsModule),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [PackingSessionsController],
  providers: [PackingSessionsService],
  exports: [PackingSessionsService],
})
export class PackingSessionsModule {}
