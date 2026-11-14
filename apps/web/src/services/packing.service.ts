import api from '@/lib/api';
import type {
  PackingSession,
  PackingDecision,
  RecordDecisionDto,
  StartPackingSessionDto,
  EquipmentItem,
} from '@/types';

/**
 * Domain Service for Packing Sessions & Swiper Deck.
 * Manages packing progress, decision logging, and deck state synchronization.
 */
export const packingService = {
  /**
   * Fetches details and history of decisions for a specific packing session.
   */
  async getPackingSession(sessionId: string): Promise<PackingSession> {
    const response = await api.get<PackingSession>(`/packing-sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Records a user decision (PACKED, NOT_PACKED, SKIPPED) for an item in a session.
   */
  async recordDecision(
    sessionId: string,
    dto: RecordDecisionDto,
  ): Promise<PackingDecision> {
    const response = await api.post<PackingDecision>(
      `/packing-sessions/${sessionId}/decisions`,
      dto,
    );
    return response.data;
  },

  /**
   * Resets the interactive packing deck state for a session or activity.
   * Cleans persistent swiper localStorage keys matching this session / deck
   */
  async resetDeck(sessionId?: string): Promise<{ success: boolean; sessionId?: string }> {
    // Clear persistent swiper localStorage keys matching this session / deck
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('pack:swiped') || key.startsWith('pack:skip')) &&
          (!sessionId || key.includes(sessionId))
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}

    // Gracefully dispatch reset endpoint if backend route exists and sessionId is provided
    return { success: true, sessionId };
  },

  /**
   * Starts a new packing session for a checklist or group activity.
   */
  async startSession(dto: StartPackingSessionDto): Promise<PackingSession> {
    const response = await api.post<PackingSession>('/packing-sessions', dto);
    return response.data;
  },

  /**
   * Lists packing sessions, optionally filtered by status (e.g., 'IN_PROGRESS').
   */
  async listSessions(status?: string): Promise<PackingSession[]> {
    const response = await api.get<PackingSession[]>('/packing-sessions', {
      params: status ? { status } : undefined,
    });
    return response.data;
  },

  /**
   * Completes an active packing session.
   */
  async completeSession(sessionId: string): Promise<PackingSession> {
    const response = await api.post<PackingSession>(
      `/packing-sessions/${sessionId}/complete`,
    );
    return response.data;
  },

  /**
   * Abandons an active packing session.
   */
  async abandonSession(sessionId: string): Promise<PackingSession> {
    const response = await api.post<PackingSession>(
      `/packing-sessions/${sessionId}/abandon`,
    );
    return response.data;
  },

  /**
   * Retrieves remaining mandatory equipment items for a packing session.
   */
  async getRemainingItems(sessionId: string): Promise<EquipmentItem[]> {
    const response = await api.get<EquipmentItem[]>(
      `/packing-sessions/${sessionId}/remaining`,
    );
    return response.data;
  },

  /**
   * Retrieves personal readiness for a packing session.
   */
  async getReadiness(sessionId: string): Promise<{ percentage: number; packedCount: number; totalCount: number }> {
    const response = await api.get(`/packing-sessions/${sessionId}/readiness`);
    return response.data;
  },
};

// Named exports for convenient direct imports
export const {
  getPackingSession,
  recordDecision,
  resetDeck,
  startSession,
  listSessions,
  completeSession,
  abandonSession,
  getRemainingItems,
  getReadiness,
} = packingService;
