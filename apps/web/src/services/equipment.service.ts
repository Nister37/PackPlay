import api from '@/lib/api';
import type {
  SharedItem,
  SharedItemCoverage,
  SharedItemWithCoverage,
  SharedResponsibility,
  CreateSharedItemDto,
  ClaimResponsibilityDto,
  PackResponsibilityDto,
  TakeOverDto,
  ExtraResponsibilityDto,
  ReportMissingDto,
  TransferResponsibilityDto,
  GroupReadiness,
} from '@/types';

/**
 * Domain Service for Equipment & Responsibilities.
 * Encapsulates all equipment, inventory coverage, and custodial claim endpoints.
 */
export const equipmentService = {
  /**
   * Fetches coverage status and assigned responsibilities for a shared equipment item.
   */
  async getCoverage(itemId: string): Promise<SharedItemCoverage> {
    const response = await api.get<SharedItemCoverage>(`/shared-items/${itemId}/coverage`);
    return response.data;
  },

  /**
   * Adds a new shared equipment item requirement to a group activity.
   */
  async addSharedItem(activityId: string, dto: CreateSharedItemDto): Promise<SharedItem> {
    const response = await api.post<SharedItem>(`/activities/${activityId}/shared-items`, dto);
    return response.data;
  },

  /**
   * Claims responsibility for bringing or managing a shared item.
   */
  async claimResponsibility(
    itemId: string,
    dto?: ClaimResponsibilityDto | { quantity?: number },
  ): Promise<SharedResponsibility> {
    const response = await api.post<SharedResponsibility>(
      `/shared-items/${itemId}/claim`,
      dto ?? {},
    );
    return response.data;
  },

  /**
   * Marks a claimed responsibility as physically packed into the kit.
   */
  async packResponsibility(
    itemId: string,
    dto?: PackResponsibilityDto | { quantity?: number },
  ): Promise<SharedResponsibility> {
    const response = await api.post<SharedResponsibility>(
      `/shared-items/${itemId}/pack`,
      dto ?? {},
    );
    return response.data;
  },

  /**
   * Takes over responsibility for an item previously reported missing or unfulfilled.
   */
  async takeOver(
    itemId: string,
    dto?: TakeOverDto | { quantity?: number },
  ): Promise<SharedResponsibility> {
    const response = await api.post<SharedResponsibility>(
      `/shared-items/${itemId}/take-over`,
      dto ?? {},
    );
    return response.data;
  },

  /**
   * Lists all shared items with full coverage status for an activity.
   */
  async listSharedItems<T = SharedItemWithCoverage[]>(activityId: string): Promise<T> {
    const response = await api.get(`/activities/${activityId}/shared-items`);
    const data = Array.isArray(response.data)
      ? response.data
      : response.data?.data ?? [];
    return data as unknown as T;
  },

  /**
   * Releases an un-packed responsibility back to the uncovered pool.
   */
  async releaseResponsibility(itemId: string): Promise<unknown> {
    const response = await api.post(`/shared-items/${itemId}/release`);
    return response.data;
  },

  /**
   * Offers extra units for a shared equipment item.
   */
  async addExtra(
    itemId: string,
    dto?: ExtraResponsibilityDto | { quantity?: number },
  ): Promise<unknown> {
    const response = await api.post(`/shared-items/${itemId}/extra`, dto ?? {});
    return response.data;
  },

  /**
   * Reports a committed item as missing or unavailable.
   */
  async reportMissing(itemId: string, dto: ReportMissingDto): Promise<unknown> {
    const response = await api.post(`/shared-items/${itemId}/report-missing`, dto);
    return response.data;
  },

  /**
   * Initiates a responsibility transfer request to another group member.
   */
  async transferResponsibility(
    itemId: string,
    dto: TransferResponsibilityDto,
  ): Promise<unknown> {
    const response = await api.post(`/shared-items/${itemId}/transfer`, dto);
    return response.data;
  },

  /**
   * Accepts a pending responsibility transfer.
   */
  async acceptTransfer(itemId: string, transferId: string): Promise<unknown> {
    const response = await api.post(
      `/shared-items/${itemId}/transfers/${transferId}/accept`,
    );
    return response.data;
  },

  /**
   * Fetches overall readiness percentage and member progress for an activity.
   */
  async getActivityReadiness(activityId: string): Promise<GroupReadiness> {
    const response = await api.get<GroupReadiness>(`/activities/${activityId}/readiness`);
    return response.data;
  },
};

// Named exports for convenient direct imports
export const {
  getCoverage,
  addSharedItem,
  claimResponsibility,
  packResponsibility,
  takeOver,
  listSharedItems,
  releaseResponsibility,
  addExtra,
  reportMissing,
  transferResponsibility,
  acceptTransfer,
  getActivityReadiness,
} = equipmentService;
