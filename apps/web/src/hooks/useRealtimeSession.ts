import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { packingService } from '@/services/packing.service';
import type {
  PackingSession,
  EquipmentItem,
  RecordDecisionDto,
  StartPackingSessionDto,
} from '@/types';

/**
 * Hook for managing interactive packing sessions and swipe deck progression.
 * Utilizes packingService instead of making direct raw API calls.
 */
export function useRealtimeSession(sessionId?: string | null) {
  const queryClient = useQueryClient();

  // Active session details
  const sessionQuery = useQuery<PackingSession>({
    queryKey: ['packing-session', sessionId],
    queryFn: () => packingService.getPackingSession(sessionId!),
    enabled: !!sessionId,
  });

  // Remaining unresolved items for current session
  const remainingQuery = useQuery<EquipmentItem[]>({
    queryKey: ['packing-session', sessionId, 'remaining'],
    queryFn: () => packingService.getRemainingItems(sessionId!),
    enabled: !!sessionId,
  });

  // Personal readiness query for current session
  const readinessQuery = useQuery<{ percentage: number; packedCount: number; totalCount: number }>({
    queryKey: ['packing-session', sessionId, 'readiness'],
    queryFn: () => packingService.getReadiness(sessionId!),
    enabled: !!sessionId,
  });

  const invalidate = () => {
    if (sessionId) {
      queryClient.invalidateQueries({ queryKey: ['packing-session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['packing-session', sessionId, 'remaining'] });
      queryClient.invalidateQueries({ queryKey: ['packing-session', sessionId, 'readiness'] });
    }
    queryClient.invalidateQueries({ queryKey: ['packing-sessions'] });
  };

  const startSessionMutation = useMutation({
    mutationFn: (dto: StartPackingSessionDto) => packingService.startSession(dto),
    onSuccess: invalidate,
  });

  const recordDecisionMutation = useMutation({
    mutationFn: (dto: RecordDecisionDto & { sessionId?: string }) => {
      const targetSessionId = dto.sessionId || sessionId;
      if (!targetSessionId) throw new Error('sessionId is required to record a decision');
      return packingService.recordDecision(targetSessionId, dto);
    },
    onSuccess: invalidate,
  });

  const resetDeckMutation = useMutation({
    mutationFn: (targetSessionId?: string) => {
      const idToReset = targetSessionId || sessionId || undefined;
      return packingService.resetDeck(idToReset);
    },
    onSuccess: invalidate,
  });

  const completeMutation = useMutation({
    mutationFn: (targetSessionId?: string) => {
      const targetId = targetSessionId || sessionId;
      if (!targetId) throw new Error('sessionId is required to complete session');
      return packingService.completeSession(targetId);
    },
    onSuccess: invalidate,
  });

  const abandonMutation = useMutation({
    mutationFn: (targetSessionId?: string) => {
      const targetId = targetSessionId || sessionId;
      if (!targetId) throw new Error('sessionId is required to abandon session');
      return packingService.abandonSession(targetId);
    },
    onSuccess: invalidate,
  });

  return {
    session: sessionQuery.data,
    isLoading: sessionQuery.isLoading,
    isError: sessionQuery.isError,
    error: sessionQuery.error,
    refetchSession: sessionQuery.refetch,

    remainingItems: remainingQuery.data ?? [],
    isRemainingLoading: remainingQuery.isLoading,
    refetchRemaining: remainingQuery.refetch,

    readiness: readinessQuery.data,
    isReadinessLoading: readinessQuery.isLoading,
    refetchReadiness: readinessQuery.refetch,

    startSession: startSessionMutation.mutateAsync,
    recordDecision: recordDecisionMutation.mutateAsync,
    resetDeck: resetDeckMutation.mutateAsync,
    completeSession: completeMutation.mutateAsync,
    abandonSession: abandonMutation.mutateAsync,

    startSessionMutation,
    recordDecisionMutation,
    resetDeckMutation,
    completeMutation,
    abandonMutation,
  };
}
