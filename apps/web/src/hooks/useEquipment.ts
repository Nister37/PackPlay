import { useQuery } from '@tanstack/react-query';
import { equipmentService } from '@/services/equipment.service';
import type { SharedItemCoverage, SharedItemWithCoverage } from '@/types';

export function useSharedItems(activityId: string | null) {
  return useQuery<SharedItemWithCoverage[]>({
    queryKey: ['shared-items', activityId],
    queryFn: () => equipmentService.listSharedItems(activityId!),
    enabled: !!activityId,
  });
}

export function useItemCoverage(itemId: string | null) {
  return useQuery<SharedItemCoverage>({
    queryKey: ['coverage', itemId],
    queryFn: () => equipmentService.getCoverage(itemId!),
    enabled: !!itemId,
  });
}

export { useSharedEquipment } from './useSharedEquipment';
