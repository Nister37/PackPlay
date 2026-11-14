import type { EquipmentItem, SharedItemWithCoverage } from './equipment';

export type PackingSessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

export type PackingDecisionType = 'PACKED' | 'NOT_PACKED' | 'SKIPPED';

export type MissingReason =
  | 'FORGOT'
  | 'COULD_NOT_BRING'
  | 'REPLACEMENT_ARRANGED'
  | 'NOT_NEEDED';

export interface PackingSession {
  id: string;
  userId: string;
  checklistId: string;
  groupActivityId?: string;
  status: PackingSessionStatus;
  startedAt: string;
  completedAt?: string;
}

export interface PackingDecision {
  id: string;
  sessionId: string;
  sharedItemId?: string;
  equipmentItemId?: string;
  decision: PackingDecisionType;
  reason?: MissingReason | string;
}

export interface RecordDecisionDto {
  sharedItemId?: string;
  equipmentItemId?: string;
  decision: PackingDecisionType;
  reason?: MissingReason | string;
}

export interface StartPackingSessionDto {
  checklistId?: string;
  groupActivityId?: string;
}

export interface DecidedItem {
  item: EquipmentItem;
  decision: PackingDecisionType;
  reason?: MissingReason;
}

export interface PackingDeckCard {
  id: string;
  name: string;
  category?: string | null;
  requiredQuantity: number;
  uncoveredQuantity?: number;
  item?: SharedItemWithCoverage | EquipmentItem;
}

export interface PackingDeckState {
  sessionId?: string;
  activityId?: string;
  swipedIds: string[];
  skippedIds: string[];
  decisions: PackingDecision[];
}

export interface GroupReadiness {
  activityId: string;
  totalSharedItems: number;
  coveredSharedItems: number;
  groupPercentage: number;
  memberReadiness: Array<{
    userId: string;
    userName: string | null;
    percentage: number;
    packedMandatoryItems: number;
    totalMandatoryItems: number;
  }>;
}
