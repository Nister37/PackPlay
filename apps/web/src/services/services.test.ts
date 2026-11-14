import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/lib/api';
import { equipmentService } from './equipment.service';
import { packingService } from './packing.service';
import { groupsService } from './groups.service';

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockGet = vi.mocked(api.get);
const mockPost = vi.mocked(api.post);
const mockPatch = vi.mocked(api.patch);
const mockDelete = vi.mocked(api.delete);

describe('Domain Services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('equipmentService', () => {
    it('getCoverage calls GET /shared-items/:itemId/coverage', async () => {
      mockGet.mockResolvedValueOnce({ data: { isCovered: true, coveredQuantity: 2 } });
      const res = await equipmentService.getCoverage('item-123');
      expect(mockGet).toHaveBeenCalledWith('/shared-items/item-123/coverage');
      expect(res.isCovered).toBe(true);
    });

    it('addSharedItem calls POST /activities/:activityId/shared-items', async () => {
      const dto = { name: 'Cones', requiredQuantity: 10 };
      mockPost.mockResolvedValueOnce({ data: { id: 'item-1', name: 'Cones' } });
      const res = await equipmentService.addSharedItem('act-1', dto);
      expect(mockPost).toHaveBeenCalledWith('/activities/act-1/shared-items', dto);
      expect(res.id).toBe('item-1');
    });

    it('claimResponsibility calls POST /shared-items/:itemId/claim', async () => {
      mockPost.mockResolvedValueOnce({ data: { id: 'resp-1', status: 'COMMITTED' } });
      const res = await equipmentService.claimResponsibility('item-1', { quantity: 2 });
      expect(mockPost).toHaveBeenCalledWith('/shared-items/item-1/claim', { quantity: 2 });
      expect(res.status).toBe('COMMITTED');
    });

    it('packResponsibility calls POST /shared-items/:itemId/pack', async () => {
      mockPost.mockResolvedValueOnce({ data: { id: 'resp-1', status: 'PACKED' } });
      const res = await equipmentService.packResponsibility('item-1', { quantity: 2 });
      expect(mockPost).toHaveBeenCalledWith('/shared-items/item-1/pack', { quantity: 2 });
      expect(res.status).toBe('PACKED');
    });

    it('takeOver calls POST /shared-items/:itemId/take-over', async () => {
      mockPost.mockResolvedValueOnce({ data: { id: 'resp-2', status: 'COMMITTED' } });
      const res = await equipmentService.takeOver('item-1', { quantity: 1 });
      expect(mockPost).toHaveBeenCalledWith('/shared-items/item-1/take-over', { quantity: 1 });
      expect(res.status).toBe('COMMITTED');
    });

    it('listSharedItems calls GET /activities/:activityId/shared-items and handles wrapped or raw arrays', async () => {
      mockGet.mockResolvedValueOnce({ data: [{ id: 'item-1', name: 'Ball' }] });
      const res = await equipmentService.listSharedItems('act-1');
      expect(mockGet).toHaveBeenCalledWith('/activities/act-1/shared-items');
      expect(res).toHaveLength(1);
    });

    it('getActivityReadiness calls GET /activities/:activityId/readiness', async () => {
      mockGet.mockResolvedValueOnce({ data: { activityId: 'act-1', groupPercentage: 80 } });
      const res = await equipmentService.getActivityReadiness('act-1');
      expect(mockGet).toHaveBeenCalledWith('/activities/act-1/readiness');
      expect(res.groupPercentage).toBe(80);
    });
  });

  describe('packingService', () => {
    it('getPackingSession calls GET /packing-sessions/:sessionId', async () => {
      mockGet.mockResolvedValueOnce({ data: { id: 'sess-1', status: 'IN_PROGRESS' } });
      const res = await packingService.getPackingSession('sess-1');
      expect(mockGet).toHaveBeenCalledWith('/packing-sessions/sess-1');
      expect(res.status).toBe('IN_PROGRESS');
    });

    it('recordDecision calls POST /packing-sessions/:sessionId/decisions', async () => {
      const dto = { equipmentItemId: 'eq-1', decision: 'PACKED' as const };
      mockPost.mockResolvedValueOnce({ data: { id: 'dec-1', decision: 'PACKED' } });
      const res = await packingService.recordDecision('sess-1', dto);
      expect(mockPost).toHaveBeenCalledWith('/packing-sessions/sess-1/decisions', dto);
      expect(res.decision).toBe('PACKED');
    });

    it('resetDeck cleans local storage for specified session', async () => {
      localStorage.setItem('pack:swiped:sess-1', '["item-1"]');

      const res = await packingService.resetDeck('sess-1');
      expect(res.success).toBe(true);
      expect(localStorage.getItem('pack:swiped:sess-1')).toBeNull();
    });

    it('resetDeck without sessionId cleans all persistent keys without dispatching post', async () => {
      localStorage.setItem('pack:swiped:user1:act1', '["item-1"]');
      localStorage.setItem('pack:skip:user1:act1', '["item-2"]');

      const res = await packingService.resetDeck();
      expect(res.success).toBe(true);
      expect(localStorage.getItem('pack:swiped:user1:act1')).toBeNull();
      expect(localStorage.getItem('pack:skip:user1:act1')).toBeNull();
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('getReadiness calls GET /packing-sessions/:sessionId/readiness', async () => {
      mockGet.mockResolvedValueOnce({ data: { percentage: 100, packedCount: 5, totalCount: 5 } });
      const res = await packingService.getReadiness('sess-1');
      expect(mockGet).toHaveBeenCalledWith('/packing-sessions/sess-1/readiness');
      expect(res.percentage).toBe(100);
    });
  });

  describe('groupsService', () => {
    it('listGroups calls GET /groups', async () => {
      mockGet.mockResolvedValueOnce({ data: [{ id: 'g-1', name: 'Alpha' }] });
      const res = await groupsService.listGroups();
      expect(mockGet).toHaveBeenCalledWith('/groups');
      expect(res).toHaveLength(1);
    });

    it('getGroup calls GET /groups/:id', async () => {
      mockGet.mockResolvedValueOnce({ data: { id: 'g-1', name: 'Alpha' } });
      const res = await groupsService.getGroup('g-1');
      expect(mockGet).toHaveBeenCalledWith('/groups/g-1');
      expect(res.name).toBe('Alpha');
    });

    it('createGroup calls POST /groups', async () => {
      const dto = { name: 'Bravo', sport: 'SOCCER' };
      mockPost.mockResolvedValueOnce({ data: { id: 'g-2', name: 'Bravo' } });
      const res = await groupsService.createGroup(dto);
      expect(mockPost).toHaveBeenCalledWith('/groups', dto);
      expect(res.id).toBe('g-2');
    });

    it('updateGroup calls PATCH /groups/:id', async () => {
      mockPatch.mockResolvedValueOnce({ data: { id: 'g-2', name: 'Updated' } });
      const res = await groupsService.updateGroup('g-2', { name: 'Updated' });
      expect(mockPatch).toHaveBeenCalledWith('/groups/g-2', { name: 'Updated' });
      expect(res.name).toBe('Updated');
    });

    it('deleteGroup calls DELETE /groups/:id', async () => {
      mockDelete.mockResolvedValueOnce({ data: undefined });
      await groupsService.deleteGroup('g-2');
      expect(mockDelete).toHaveBeenCalledWith('/groups/g-2');
    });

    it('createInvitation and getInvitations call respective endpoints', async () => {
      mockPost.mockResolvedValueOnce({ data: { id: 'inv-1', token: 'tok-123' } });
      const created = await groupsService.createInvitation('g-1', { expiresInHours: 24 });
      expect(mockPost).toHaveBeenCalledWith('/groups/g-1/invitations', { expiresInHours: 24 });
      expect(created.token).toBe('tok-123');

      mockGet.mockResolvedValueOnce({ data: [{ id: 'inv-1' }] });
      const list = await groupsService.getInvitations('g-1');
      expect(mockGet).toHaveBeenCalledWith('/groups/g-1/invitations');
      expect(list).toHaveLength(1);
    });

    it('broadcastReminder calls POST /groups/:id/activities/:actId/broadcast-reminder', async () => {
      mockPost.mockResolvedValueOnce({ data: { notifiedCount: 4 } });
      const res = await groupsService.broadcastReminder('g-1', 'act-1');
      expect(mockPost).toHaveBeenCalledWith('/groups/g-1/activities/act-1/broadcast-reminder');
      expect(res).toEqual({ notifiedCount: 4 });
    });
  });
});
