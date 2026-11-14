import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { equipmentService } from '@/services/equipment.service';
import type {
  SharedItemCoverage,
  SharedItemWithCoverage,
  ClaimResponsibilityDto,
  PackResponsibilityDto,
  TakeOverDto,
  CreateSharedItemDto,
  ExtraResponsibilityDto,
  ReportMissingDto,
  TransferResponsibilityDto,
  GroupReadiness,
} from '@/types';

interface UseSharedEquipmentOptions {
  itemId?: string | null;
  activityId?: string | null;
}

/**
 * Hook for managing shared equipment coverage, custodial claims, and items.
 * Utilizes equipmentService instead of calling raw API endpoints directly.
 */
export function useSharedEquipment(
  itemIdOrOptions?: string | null | UseSharedEquipmentOptions,
) {
  const queryClient = useQueryClient();

  const itemId =
    typeof itemIdOrOptions === 'string' || itemIdOrOptions === null
      ? itemIdOrOptions
      : itemIdOrOptions?.itemId;
  const activityId =
    typeof itemIdOrOptions === 'object' && itemIdOrOptions !== null
      ? itemIdOrOptions.activityId
      : undefined;

  // Coverage query for single item
  const coverageQuery = useQuery<SharedItemCoverage>({
    queryKey: ['coverage', itemId],
    queryFn: () => equipmentService.getCoverage(itemId!),
    enabled: !!itemId,
  });

  // Items query for entire activity
  const itemsQuery = useQuery<SharedItemWithCoverage[]>({
    queryKey: ['shared-items', activityId],
    queryFn: () => equipmentService.listSharedItems(activityId!),
    enabled: !!activityId,
  });

  // Readiness query for activity
  const readinessQuery = useQuery<GroupReadiness>({
    queryKey: ['readiness', activityId],
    queryFn: () => equipmentService.getActivityReadiness(activityId!),
    enabled: !!activityId,
  });

  const invalidate = () => {
    if (itemId) queryClient.invalidateQueries({ queryKey: ['coverage', itemId] });
    if (activityId) {
      queryClient.invalidateQueries({ queryKey: ['shared-items', activityId] });
      queryClient.invalidateQueries({ queryKey: ['readiness', activityId] });
    }
    queryClient.invalidateQueries({ queryKey: ['coverage'] });
    queryClient.invalidateQueries({ queryKey: ['shared-items'] });
    queryClient.invalidateQueries({ queryKey: ['readiness'] });
  };

  const claimMutation = useMutation({
    mutationFn: (dto?: ClaimResponsibilityDto | { quantity?: number; itemId?: string }) => {
      const targetId = (dto as any)?.itemId || itemId;
      if (!targetId) throw new Error('itemId is required to claim responsibility');
      return equipmentService.claimResponsibility(targetId, dto);
    },
    onSuccess: invalidate,
  });

  const packMutation = useMutation({
    mutationFn: (dto?: PackResponsibilityDto | { quantity?: number; itemId?: string }) => {
      const targetId = (dto as any)?.itemId || itemId;
      if (!targetId) throw new Error('itemId is required to pack responsibility');
      return equipmentService.packResponsibility(targetId, dto);
    },
    onSuccess: invalidate,
  });

  const takeOverMutation = useMutation({
    mutationFn: (dto?: TakeOverDto | { quantity?: number; itemId?: string }) => {
      const targetId = (dto as any)?.itemId || itemId;
      if (!targetId) throw new Error('itemId is required to take over');
      return equipmentService.takeOver(targetId, dto);
    },
    onSuccess: invalidate,
  });

  const addSharedItemMutation = useMutation({
    mutationFn: (params: { activityId?: string; dto: CreateSharedItemDto } | CreateSharedItemDto) => {
      const targetActId = 'activityId' in params && params.activityId ? params.activityId : activityId;
      const targetDto = 'dto' in params ? params.dto : params;
      if (!targetActId) throw new Error('activityId is required to add shared item');
      return equipmentService.addSharedItem(targetActId, targetDto);
    },
    onSuccess: invalidate,
  });

  const releaseMutation = useMutation({
    mutationFn: (params?: { itemId?: string }) => {
      const targetId = params?.itemId || itemId;
      if (!targetId) throw new Error('itemId is required to release responsibility');
      return equipmentService.releaseResponsibility(targetId);
    },
    onSuccess: invalidate,
  });

  const extraMutation = useMutation({
    mutationFn: (dto?: ExtraResponsibilityDto | { quantity?: number; itemId?: string }) => {
      const targetId = (dto as any)?.itemId || itemId;
      if (!targetId) throw new Error('itemId is required to add extra responsibility');
      return equipmentService.addExtra(targetId, dto);
    },
    onSuccess: invalidate,
  });

  const reportMissingMutation = useMutation({
    mutationFn: (params: ReportMissingDto & { itemId?: string }) => {
      const targetId = params.itemId || itemId;
      if (!targetId) throw new Error('itemId is required to report missing');
      return equipmentService.reportMissing(targetId, { reason: params.reason });
    },
    onSuccess: invalidate,
  });

  const transferMutation = useMutation({
    mutationFn: (params: TransferResponsibilityDto & { itemId?: string }) => {
      const targetId = params.itemId || itemId;
      if (!targetId) throw new Error('itemId is required to transfer responsibility');
      return equipmentService.transferResponsibility(targetId, {
        targetUserId: params.targetUserId,
        quantity: params.quantity,
      });
    },
    onSuccess: invalidate,
  });

  const acceptTransferMutation = useMutation({
    mutationFn: (params: { transferId: string; itemId?: string }) => {
      const targetId = params.itemId || itemId;
      if (!targetId) throw new Error('itemId is required to accept transfer');
      return equipmentService.acceptTransfer(targetId, params.transferId);
    },
    onSuccess: invalidate,
  });

  return {
    coverage: coverageQuery.data,
    isLoading: coverageQuery.isLoading,
    isError: coverageQuery.isError,
    error: coverageQuery.error,
    refetchCoverage: coverageQuery.refetch,

    items: itemsQuery.data,
    isItemsLoading: itemsQuery.isLoading,
    refetchItems: itemsQuery.refetch,

    readiness: readinessQuery.data,
    isReadinessLoading: readinessQuery.isLoading,
    refetchReadiness: readinessQuery.refetch,

    claimResponsibility: claimMutation.mutateAsync,
    packResponsibility: packMutation.mutateAsync,
    takeOver: takeOverMutation.mutateAsync,
    addSharedItem: addSharedItemMutation.mutateAsync,
    releaseResponsibility: releaseMutation.mutateAsync,
    addExtra: extraMutation.mutateAsync,
    reportMissing: reportMissingMutation.mutateAsync,
    transferResponsibility: transferMutation.mutateAsync,
    acceptTransfer: acceptTransferMutation.mutateAsync,

    claimMutation,
    packMutation,
    takeOverMutation,
    addSharedItemMutation,
    releaseMutation,
    extraMutation,
    reportMissingMutation,
    transferMutation,
    acceptTransferMutation,
  };
}
