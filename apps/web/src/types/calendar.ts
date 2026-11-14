export interface CalendarFeed {
  id: string;
  groupId: string;
  name: string;
  feedUrlMasked?: string;
  lastSyncedAt?: string | null;
  syncStatus?: 'SUCCESS' | 'FAILED' | 'PENDING';
  lastError?: string | null;
  eventCount?: number;
  createdAt: string;
}

export interface CalendarPreviewEvent {
  title: string;
  startsAt?: string | Date;
  endsAt?: string | Date;
  startDate?: string;
  endDate?: string;
  description?: string;
  location?: string;
}
