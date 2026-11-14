/**
 * Real-Time Live Packing Protocol Schemas and Contracts
 *
 * Defines published language events and payload interfaces for WebSocket
 * live packing sessions, deck synchronization, and readiness tracking.
 */

import { ContractValidationResult } from './equipment-manifest.contract';
import { isValidIsoDateString } from './calendar-schedule.contract';

export const REALTIME_PACKING_EVENTS = {
  ITEM_PACKED: 'packing:item-packed',
  CUSTODY_TAKEOVER: 'packing:custody-takeover',
  DECK_SYNC: 'packing:deck-sync',
  READINESS_UPDATE: 'packing:readiness-update',
} as const;

export type RealtimePackingEventType =
  (typeof REALTIME_PACKING_EVENTS)[keyof typeof REALTIME_PACKING_EVENTS];

export const READINESS_STATUSES = ['CRITICAL', 'NEEDS_ATTENTION', 'GAME_READY'] as const;
export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

export function isReadinessStatus(value: unknown): value is ReadinessStatus {
  return typeof value === 'string' && READINESS_STATUSES.includes(value as ReadinessStatus);
}

/**
 * Payload broadcast when an item is packed in a session.
 */
export interface RealtimeItemPackedPayload {
  sessionId: string;
  activityId: string;
  itemId: string;
  userId: string;
  quantity: number;
  timestamp: string;
}

/**
 * Payload broadcast when item custody is transferred/taken over.
 */
export interface RealtimeCustodyTakeoverPayload {
  sessionId: string;
  itemId: string;
  previousUserId?: string;
  newUserId: string;
  quantity: number;
}

/**
 * Payload broadcast during card deck synchronization in swipe mode.
 */
export interface RealtimeDeckSyncPayload {
  sessionId: string;
  activityId: string;
  currentCardIndex: number;
  totalCards: number;
  readinessScore: number;
}

/**
 * Payload broadcast when overall activity readiness score/status changes.
 */
export interface RealtimeReadinessUpdatePayload {
  activityId: string;
  readinessScore: number;
  status: ReadinessStatus;
}

/**
 * Validates a RealtimeItemPackedPayload object.
 */
export function validateRealtimeItemPackedPayload(
  value: unknown,
): ContractValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['Payload must be a non-null object'] };
  }
  const obj = value as Record<string, unknown>;

  if (typeof obj.sessionId !== 'string' || obj.sessionId.trim().length === 0) {
    errors.push('sessionId must be a non-empty string');
  }
  if (typeof obj.activityId !== 'string' || obj.activityId.trim().length === 0) {
    errors.push('activityId must be a non-empty string');
  }
  if (typeof obj.itemId !== 'string' || obj.itemId.trim().length === 0) {
    errors.push('itemId must be a non-empty string');
  }
  if (typeof obj.userId !== 'string' || obj.userId.trim().length === 0) {
    errors.push('userId must be a non-empty string');
  }
  if (
    typeof obj.quantity !== 'number' ||
    !Number.isFinite(obj.quantity) ||
    obj.quantity <= 0
  ) {
    errors.push('quantity must be a positive number greater than 0');
  }
  if (!isValidIsoDateString(obj.timestamp)) {
    errors.push('timestamp must be a valid ISO 8601 date string');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Type guard for RealtimeItemPackedPayload.
 */
export function isRealtimeItemPackedPayload(
  value: unknown,
): value is RealtimeItemPackedPayload {
  return validateRealtimeItemPackedPayload(value).valid;
}

/**
 * Validates a RealtimeCustodyTakeoverPayload object.
 */
export function validateRealtimeCustodyTakeoverPayload(
  value: unknown,
): ContractValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['Payload must be a non-null object'] };
  }
  const obj = value as Record<string, unknown>;

  if (typeof obj.sessionId !== 'string' || obj.sessionId.trim().length === 0) {
    errors.push('sessionId must be a non-empty string');
  }
  if (typeof obj.itemId !== 'string' || obj.itemId.trim().length === 0) {
    errors.push('itemId must be a non-empty string');
  }
  if (
    obj.previousUserId !== undefined &&
    (typeof obj.previousUserId !== 'string' || obj.previousUserId.trim().length === 0)
  ) {
    errors.push('previousUserId must be a non-empty string if provided');
  }
  if (typeof obj.newUserId !== 'string' || obj.newUserId.trim().length === 0) {
    errors.push('newUserId must be a non-empty string');
  }
  if (
    typeof obj.previousUserId === 'string' &&
    typeof obj.newUserId === 'string' &&
    obj.previousUserId.trim().length > 0 &&
    obj.previousUserId.trim() === obj.newUserId.trim()
  ) {
    errors.push('previousUserId and newUserId cannot be the same user');
  }
  if (
    typeof obj.quantity !== 'number' ||
    !Number.isFinite(obj.quantity) ||
    obj.quantity <= 0
  ) {
    errors.push('quantity must be a positive number greater than 0');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Type guard for RealtimeCustodyTakeoverPayload.
 */
export function isRealtimeCustodyTakeoverPayload(
  value: unknown,
): value is RealtimeCustodyTakeoverPayload {
  return validateRealtimeCustodyTakeoverPayload(value).valid;
}

/**
 * Validates a RealtimeDeckSyncPayload object.
 */
export function validateRealtimeDeckSyncPayload(
  value: unknown,
): ContractValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['Payload must be a non-null object'] };
  }
  const obj = value as Record<string, unknown>;

  if (typeof obj.sessionId !== 'string' || obj.sessionId.trim().length === 0) {
    errors.push('sessionId must be a non-empty string');
  }
  if (typeof obj.activityId !== 'string' || obj.activityId.trim().length === 0) {
    errors.push('activityId must be a non-empty string');
  }
  if (
    typeof obj.currentCardIndex !== 'number' ||
    !Number.isInteger(obj.currentCardIndex) ||
    obj.currentCardIndex < 0
  ) {
    errors.push('currentCardIndex must be a non-negative integer');
  }
  if (
    typeof obj.totalCards !== 'number' ||
    !Number.isInteger(obj.totalCards) ||
    obj.totalCards < 0
  ) {
    errors.push('totalCards must be a non-negative integer');
  }
  if (
    typeof obj.currentCardIndex === 'number' &&
    typeof obj.totalCards === 'number' &&
    Number.isInteger(obj.currentCardIndex) &&
    Number.isInteger(obj.totalCards) &&
    obj.currentCardIndex > obj.totalCards
  ) {
    errors.push('currentCardIndex cannot exceed totalCards');
  }
  if (
    typeof obj.readinessScore !== 'number' ||
    !Number.isFinite(obj.readinessScore) ||
    obj.readinessScore < 0 ||
    obj.readinessScore > 100
  ) {
    errors.push('readinessScore must be a number between 0 and 100');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Type guard for RealtimeDeckSyncPayload.
 */
export function isRealtimeDeckSyncPayload(
  value: unknown,
): value is RealtimeDeckSyncPayload {
  return validateRealtimeDeckSyncPayload(value).valid;
}

/**
 * Validates a RealtimeReadinessUpdatePayload object.
 */
export function validateRealtimeReadinessUpdatePayload(
  value: unknown,
): ContractValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['Payload must be a non-null object'] };
  }
  const obj = value as Record<string, unknown>;

  if (typeof obj.activityId !== 'string' || obj.activityId.trim().length === 0) {
    errors.push('activityId must be a non-empty string');
  }
  if (
    typeof obj.readinessScore !== 'number' ||
    !Number.isFinite(obj.readinessScore) ||
    obj.readinessScore < 0 ||
    obj.readinessScore > 100
  ) {
    errors.push('readinessScore must be a number between 0 and 100');
  }
  if (!isReadinessStatus(obj.status)) {
    errors.push(`status must be one of: ${READINESS_STATUSES.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Type guard for RealtimeReadinessUpdatePayload.
 */
export function isRealtimeReadinessUpdatePayload(
  value: unknown,
): value is RealtimeReadinessUpdatePayload {
  return validateRealtimeReadinessUpdatePayload(value).valid;
}

/**
 * Factory helper for creating RealtimeItemPackedPayload.
 */
export function createRealtimeItemPackedPayload(
  input: Omit<RealtimeItemPackedPayload, 'timestamp'> & { timestamp?: string },
): RealtimeItemPackedPayload {
  const payload: RealtimeItemPackedPayload = {
    ...input,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
  const validation = validateRealtimeItemPackedPayload(payload);
  if (!validation.valid) {
    throw new Error(
      `Failed to create RealtimeItemPackedPayload: ${validation.errors.join('; ')}`,
    );
  }
  return payload;
}

/**
 * Factory helper for creating RealtimeCustodyTakeoverPayload.
 */
export function createRealtimeCustodyTakeoverPayload(
  input: RealtimeCustodyTakeoverPayload,
): RealtimeCustodyTakeoverPayload {
  const validation = validateRealtimeCustodyTakeoverPayload(input);
  if (!validation.valid) {
    throw new Error(
      `Failed to create RealtimeCustodyTakeoverPayload: ${validation.errors.join('; ')}`,
    );
  }
  return { ...input };
}

/**
 * Factory helper for creating RealtimeDeckSyncPayload.
 */
export function createRealtimeDeckSyncPayload(
  input: RealtimeDeckSyncPayload,
): RealtimeDeckSyncPayload {
  const validation = validateRealtimeDeckSyncPayload(input);
  if (!validation.valid) {
    throw new Error(
      `Failed to create RealtimeDeckSyncPayload: ${validation.errors.join('; ')}`,
    );
  }
  return { ...input };
}

/**
 * Factory helper for creating RealtimeReadinessUpdatePayload.
 */
export function createRealtimeReadinessUpdatePayload(
  input: RealtimeReadinessUpdatePayload,
): RealtimeReadinessUpdatePayload {
  const validation = validateRealtimeReadinessUpdatePayload(input);
  if (!validation.valid) {
    throw new Error(
      `Failed to create RealtimeReadinessUpdatePayload: ${validation.errors.join('; ')}`,
    );
  }
  return { ...input };
}
