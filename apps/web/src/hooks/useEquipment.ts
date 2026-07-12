import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export function useSharedItems(activityId: string | null) {
  return useQuery({
    queryKey: ['shared-items', activityId],
    queryFn: () =>
      api.get(`/activities/${activityId}/shared-items`).then((r) => r.data),
    enabled: !!activityId,
  });
}

export function useItemCoverage(itemId: string | null) {
  return useQuery({
    queryKey: ['coverage', itemId],
    queryFn: () =>
      api.get(`/shared-items/${itemId}/coverage`).then((r) => r.data),
    enabled: !!itemId,
  });
}
