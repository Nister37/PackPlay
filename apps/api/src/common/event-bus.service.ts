import { Injectable, OnModuleDestroy, Type } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

@Injectable()
export class EventBusService implements OnModuleDestroy {
  private readonly subject$ = new Subject<any>();

  publish<T extends object>(event: T): void {
    if (!this.subject$.closed) {
      this.subject$.next(event);
    }
  }

  ofType<T>(eventType: Type<T>): Observable<T> {
    return this.subject$.asObservable().pipe(
      filter(
        (event): event is T =>
          event instanceof eventType ||
          (Boolean(event) && event.constructor?.name === eventType.name),
      ),
    );
  }

  asObservable(): Observable<any> {
    return this.subject$.asObservable();
  }

  onModuleDestroy(): void {
    this.subject$.complete();
  }
}
