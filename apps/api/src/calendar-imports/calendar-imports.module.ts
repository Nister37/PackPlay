import { Module } from '@nestjs/common';
import { CalendarImportsController } from './calendar-imports.controller';
import { CalendarImportsService } from './calendar-imports.service';
import { CalendarParserService } from './calendar-parser.service';
import { CalendarSecurityService } from './calendar-security.service';

@Module({
  controllers: [CalendarImportsController],
  providers: [
    CalendarImportsService,
    CalendarParserService,
    CalendarSecurityService,
  ],
  exports: [CalendarImportsService],
})
export class CalendarImportsModule {}
