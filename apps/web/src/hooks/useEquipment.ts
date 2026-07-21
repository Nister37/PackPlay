import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { SharedItemCoverage, SharedItemWithCoverage } from '@/types';

export function useSharedItems(activityId: string | null) {
  return useQuery<SharedItemWithCoverage[]>({
    queryKey: ['shared-items', activityId],
    queryFn: () =>
      api.get(`/activities/${activityId}/shared-items`).then((r) => r.data),
    enabled: !!activityId,
  });
}

export function useItemCoverage(itemId: string | null) {
  return useQuery<SharedItemCoverage>({
    queryKey: ['coverage', itemId],
    queryFn: () =>
      api.get(`/shared-items/${itemId}/coverage`).then((r) => r.data),
    enabled: !!itemId,
  });
}
