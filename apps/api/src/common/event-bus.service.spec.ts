import { EventBusService } from './event-bus.service';
import { ItemCreatedEvent, ItemPackedEvent } from './domain-events';

describe('EventBusService', () => {
  let service: EventBusService;

  beforeEach(() => {
    service = new EventBusService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should publish and receive filtered events via ofType', (done) => {
    const received: ItemCreatedEvent[] = [];

    service.ofType(ItemCreatedEvent).subscribe({
      next: (event) => {
        received.push(event);
        expect(event.itemId).toBe('item-123');
        expect(event.groupId).toBe('group-1');
        done();
      },
    });

    // Publish an unrelated event first
    service.publish(
      new ItemPackedEvent({
        activityId: 'act-1',
        itemId: 'item-999',
        userId: 'user-1',
      }),
    );

    // Publish the expected event
    service.publish(
      new ItemCreatedEvent({
        activityId: 'act-1',
        itemId: 'item-123',
        groupId: 'group-1',
        createdById: 'user-1',
        catalogueItemId: 'cat-1',
      }),
    );
  });

  it('completes the subject on module destroy', () => {
    let completed = false;
    service.asObservable().subscribe({
      complete: () => {
        completed = true;
      },
    });

    service.onModuleDestroy();
    expect(completed).toBe(true);
  });
});
