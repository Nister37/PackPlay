import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSharedEquipment } from './useSharedEquipment';
import { useRealtimeSession } from './useRealtimeSession';
import { useGroup, useGroups } from './useGroup';
import { equipmentService } from '@/services/equipment.service';
import { packingService } from '@/services/packing.service';
import { groupsService } from '@/services/groups.service';

vi.mock('@/services/equipment.service', () => ({
  equipmentService: {
    getCoverage: vi.fn(),
    addSharedItem: vi.fn(),
    claimResponsibility: vi.fn(),
    packResponsibility: vi.fn(),
    takeOver: vi.fn(),
    listSharedItems: vi.fn(),
    releaseResponsibility: vi.fn(),
  },
}));

vi.mock('@/services/packing.service', () => ({
  packingService: {
    getPackingSession: vi.fn(),
    recordDecision: vi.fn(),
    resetDeck: vi.fn(),
    startSession: vi.fn(),
    listSessions: vi.fn(),
    completeSession: vi.fn(),
    abandonSession: vi.fn(),
    getRemainingItems: vi.fn(),
  },
}));

vi.mock('@/services/groups.service', () => ({
  groupsService: {
    listGroups: vi.fn(),
    getGroup: vi.fn(),
    createGroup: vi.fn(),
    getGroupMembers: vi.fn(),
    getGroupActivities: vi.fn(),
    deleteGroup: vi.fn(),
    leaveGroup: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Domain Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(equipmentService.getCoverage).mockResolvedValue({ isCovered: true, coveredQuantity: 1 } as any);
    vi.mocked(equipmentService.listSharedItems).mockResolvedValue([] as any);
    vi.mocked(packingService.getPackingSession).mockResolvedValue({ id: 'sess-default', status: 'IN_PROGRESS' } as any);
    vi.mocked(packingService.getRemainingItems).mockResolvedValue([] as any);
    vi.mocked(groupsService.getGroup).mockResolvedValue({ id: 'g-default', name: 'Default' } as any);
    vi.mocked(groupsService.getGroupMembers).mockResolvedValue([] as any);
    vi.mocked(groupsService.getGroupActivities).mockResolvedValue([] as any);
    vi.mocked(groupsService.listGroups).mockResolvedValue([] as any);
  });

  describe('useSharedEquipment', () => {
    it('queries coverage via equipmentService.getCoverage', async () => {
      vi.mocked(equipmentService.getCoverage).mockResolvedValueOnce({
        isCovered: true,
        coveredQuantity: 5,
      } as any);

      const { result } = renderHook(() => useSharedEquipment('item-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(equipmentService.getCoverage).toHaveBeenCalledWith('item-1');
      expect(result.current.coverage?.isCovered).toBe(true);
    });

    it('mutates claim via equipmentService.claimResponsibility', async () => {
      vi.mocked(equipmentService.claimResponsibility).mockResolvedValueOnce({
        id: 'resp-1',
        status: 'COMMITTED',
      } as any);

      const { result } = renderHook(() => useSharedEquipment('item-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.claimResponsibility({ quantity: 2 });
      });

      expect(equipmentService.claimResponsibility).toHaveBeenCalledWith('item-1', {
        quantity: 2,
      });
    });

    it('mutates pack via equipmentService.packResponsibility', async () => {
      vi.mocked(equipmentService.packResponsibility).mockResolvedValueOnce({
        id: 'resp-1',
        status: 'PACKED',
      } as any);

      const { result } = renderHook(() => useSharedEquipment('item-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.packResponsibility({ quantity: 2 });
      });

      expect(equipmentService.packResponsibility).toHaveBeenCalledWith('item-1', {
        quantity: 2,
      });
    });

    it('mutates takeOver via equipmentService.takeOver', async () => {
      vi.mocked(equipmentService.takeOver).mockResolvedValueOnce({
        id: 'resp-2',
        status: 'COMMITTED',
      } as any);

      const { result } = renderHook(() => useSharedEquipment('item-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.takeOver({ quantity: 1 });
      });

      expect(equipmentService.takeOver).toHaveBeenCalledWith('item-1', { quantity: 1 });
    });
  });

  describe('useRealtimeSession', () => {
    it('queries packing session via packingService.getPackingSession', async () => {
      vi.mocked(packingService.getPackingSession).mockResolvedValueOnce({
        id: 'sess-1',
        status: 'IN_PROGRESS',
      } as any);
      vi.mocked(packingService.getRemainingItems).mockResolvedValueOnce([]);

      const { result } = renderHook(() => useRealtimeSession('sess-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(packingService.getPackingSession).toHaveBeenCalledWith('sess-1');
      expect(result.current.session?.id).toBe('sess-1');
    });

    it('records decision via packingService.recordDecision', async () => {
      vi.mocked(packingService.recordDecision).mockResolvedValueOnce({
        id: 'dec-1',
        decision: 'PACKED',
      } as any);

      const { result } = renderHook(() => useRealtimeSession('sess-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.recordDecision({
          equipmentItemId: 'item-1',
          decision: 'PACKED',
        });
      });

      expect(packingService.recordDecision).toHaveBeenCalledWith('sess-1', {
        equipmentItemId: 'item-1',
        decision: 'PACKED',
      });
    });

    it('resets deck via packingService.resetDeck', async () => {
      vi.mocked(packingService.resetDeck).mockResolvedValueOnce({
        success: true,
        sessionId: 'sess-1',
      });

      const { result } = renderHook(() => useRealtimeSession('sess-1'), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.resetDeck();
      });

      expect(packingService.resetDeck).toHaveBeenCalledWith('sess-1');
    });
  });

  describe('useGroup and useGroups', () => {
    it('queries groups via groupsService.listGroups in useGroups', async () => {
      vi.mocked(groupsService.listGroups).mockResolvedValueOnce([
        { id: 'g-1', name: 'Squad A' },
      ] as any);

      const { result } = renderHook(() => useGroups(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(groupsService.listGroups).toHaveBeenCalled();
      expect(result.current.groups).toHaveLength(1);
    });

    it('queries group details and creates group via useGroup', async () => {
      vi.mocked(groupsService.getGroup).mockResolvedValueOnce({
        id: 'g-1',
        name: 'Squad A',
      } as any);
      vi.mocked(groupsService.getGroupMembers).mockResolvedValueOnce([]);
      vi.mocked(groupsService.getGroupActivities).mockResolvedValueOnce([]);
      vi.mocked(groupsService.createGroup).mockResolvedValueOnce({
        id: 'g-2',
        name: 'Squad B',
      } as any);

      const { result } = renderHook(() => useGroup('g-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(groupsService.getGroup).toHaveBeenCalledWith('g-1');

      await act(async () => {
        await result.current.createGroup({ name: 'Squad B' });
      });

      expect(groupsService.createGroup).toHaveBeenCalledWith({ name: 'Squad B' });
    });
  });
});
