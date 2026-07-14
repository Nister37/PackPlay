import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Notification } from '@/types';

interface ApiNotification {
  id: string;
  userId: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  payload?: Record<string, unknown>;
}

interface NotificationPage {
  data: ApiNotification[];
}

const notificationCopy: Record<string, { title: string; fallback: string }> = {
  ITEM_MISSING: { title: 'ITEM MISSING', fallback: 'A required group item is no longer covered.' },
  ITEM_RELEASED: { title: 'ITEM RELEASED', fallback: 'A member released an item responsibility.' },
  ITEM_CLAIMED: { title: 'ITEM CLAIMED', fallback: 'A member claimed an item responsibility.' },
  ITEM_PACKED: { title: 'ITEM PACKED', fallback: 'A shared item was packed.' },
  TAKEOVER_REQUESTED: {
    title: 'TAKEOVER REQUESTED',
    fallback: 'A missing item needs a new owner.',
  },
  COVERAGE_UPDATED: { title: 'COVERAGE UPDATED', fallback: 'Shared-item coverage changed.' },
  READINESS_UPDATED: { title: 'READINESS UPDATED', fallback: 'Group readiness changed.' },
};

export function mapNotification(raw: ApiNotification): Notification {
  const copy = notificationCopy[raw.type] ?? {
    title: raw.type.replace(/_/g, ' '),
    fallback: 'There is an update for your group.',
  };
  const itemName =
    typeof raw.payload?.sharedItemName === 'string' ? raw.payload.sharedItemName : null;
  const reason =
    typeof raw.payload?.reason === 'string'
      ? raw.payload.reason.replace(/_/g, ' ').toLowerCase()
      : null;

  return {
    id: raw.id,
    userId: raw.userId,
    type: raw.type,
    title: copy.title,
    body: itemName ? `${itemName}${reason ? `: ${reason}` : ''}` : copy.fallback,
    read: raw.isRead,
    createdAt: raw.createdAt,
    data: raw.payload,
  };
}

export function useNotifications() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () =>
      api.get<NotificationPage>('/notifications').then((r) => r.data.data.map(mapNotification)),
    refetchInterval: 30_000, // poll every 30s as fallback
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    isLoading,
    unreadCount,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
  };
}
