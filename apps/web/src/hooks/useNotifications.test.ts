import { describe, expect, it } from 'vitest';
import { mapNotification } from './useNotifications';

describe('mapNotification', () => {
  it('maps the API shape into bell-ready copy', () => {
    const result = mapNotification({
      id: 'notification-1',
      userId: 'user-1',
      type: 'ITEM_MISSING',
      isRead: false,
      createdAt: '2026-07-15T00:00:00.000Z',
      payload: { sharedItemName: '<script>alert(1)</script>', reason: 'COULD_NOT_BRING' },
    });
    expect(result).toMatchObject({
      title: 'ITEM MISSING',
      body: '<script>alert(1)</script>: could not bring',
      read: false,
    });
  });

  it('provides fallback copy for an unknown type', () => {
    const result = mapNotification({
      id: 'notification-2',
      userId: 'user-1',
      type: 'NEW_EVENT',
      isRead: true,
      createdAt: '2026-07-15T00:00:00.000Z',
    });
    expect(result.title).toBe('NEW EVENT');
    expect(result.body).toBe('There is an update for your group.');
  });
});
