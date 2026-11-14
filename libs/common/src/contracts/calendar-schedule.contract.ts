/**
 * Calendar & Schedule Interchange Contract (V1)
 *
 * Defines standard schedule feed format compatible with RFC 5545 iCalendar:
 * interchange contract for calendar feeds, events, and synchronizations.
 */

import { ContractValidationResult } from './equipment-manifest.contract';

export interface CalendarManifestSummaryV1 {
  totalItems: number;
  isFullyCovered: boolean;
}

export interface CalendarScheduleExportContractV1 {
  eventId: string;
  groupId: string;
  summary: string;
  description?: string;
  location?: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  recurrenceRule?: string; // RRULE format
  manifestSummary?: {
    totalItems: number;
    isFullyCovered: boolean;
  };
}

/**
 * Validates whether a value is a valid ISO 8601 date string.
 * Enforces valid calendar dates, leap years, time bounds, and timezone offsets.
 */
export function isValidIsoDateString(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  // Accepts ISO 8601 representation:
  // e.g. 2026-11-14T10:00:00Z, 2026-11-14T10:00:00.000Z, 2026-11-14T10:00:00+01:00, or local 2026-11-14T10:00:00
  const isoPattern =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|([+-]\d{2})(?::?(\d{2}))?)?$/;
  const match = isoPattern.exec(value);
  if (!match) return false;

  const y = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const d = parseInt(match[3], 10);
  const h = parseInt(match[4], 10);
  const min = parseInt(match[5], 10);
  const s = parseInt(match[6], 10);

  if (m < 1 || m > 12) return false;
  if (h > 23 || min > 59 || s > 59) return false;

  // Validate calendar days matching month and leap years
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d < 1 || d > daysInMonth) return false;

  // Validate timezone offset if provided
  if (match[8]) {
    const tzH = Math.abs(parseInt(match[8], 10));
    const tzM = match[9] ? parseInt(match[9], 10) : 0;
    if (tzH > 14 || tzM > 59) return false;
  }

  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp);
}

export const VALID_RRULE_KEYS = [
  'FREQ',
  'UNTIL',
  'COUNT',
  'INTERVAL',
  'BYSECOND',
  'BYMINUTE',
  'BYHOUR',
  'BYDAY',
  'BYMONTHDAY',
  'BYYEARDAY',
  'BYWEEKNO',
  'BYMONTH',
  'BYSETPOS',
  'WKST',
] as const;

export const VALID_RRULE_FREQUENCIES = [
  'SECONDLY',
  'MINUTELY',
  'HOURLY',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
] as const;

const RRULE_KEYS_SET = new Set<string>(VALID_RRULE_KEYS);
const RRULE_FREQS_SET = new Set<string>(VALID_RRULE_FREQUENCIES);
const RRULE_WKST_DAYS = new Set<string>(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']);

/**
 * Validates whether a string matches RFC 5545 RRULE syntax.
 */
export function isValidRruleString(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  const clean = value.startsWith('RRULE:') ? value.substring(6).trim() : value.trim();
  if (clean.length === 0) return false;

  const parts = clean.split(';');
  let hasFreq = false;

  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) return false;
    const key = part.slice(0, eqIdx).toUpperCase();
    const val = part.slice(eqIdx + 1);
    if (!val || !RRULE_KEYS_SET.has(key)) return false;

    if (key === 'FREQ') {
      if (!RRULE_FREQS_SET.has(val.toUpperCase())) return false;
      hasFreq = true;
    } else if (key === 'COUNT' || key === 'INTERVAL') {
      const num = Number(val);
      if (!Number.isInteger(num) || num <= 0) return false;
    } else if (key === 'WKST') {
      if (!RRULE_WKST_DAYS.has(val.toUpperCase())) return false;
    }
  }

  return hasFreq;
}

/**
 * Validates a CalendarManifestSummaryV1 object.
 */
export function validateCalendarManifestSummaryV1(
  value: unknown,
): ContractValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['manifestSummary must be a non-null object'] };
  }
  const obj = value as Record<string, unknown>;

  if (
    typeof obj.totalItems !== 'number' ||
    !Number.isInteger(obj.totalItems) ||
    obj.totalItems < 0
  ) {
    errors.push('totalItems must be a non-negative integer');
  }
  if (typeof obj.isFullyCovered !== 'boolean') {
    errors.push('isFullyCovered must be a boolean');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Type guard for CalendarManifestSummaryV1.
 */
export function isCalendarManifestSummaryV1(
  value: unknown,
): value is CalendarManifestSummaryV1 {
  return validateCalendarManifestSummaryV1(value).valid;
}

/**
 * Validates a CalendarScheduleExportContractV1 object.
 */
export function validateCalendarScheduleExportContractV1(
  value: unknown,
): ContractValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['Schedule export contract must be a non-null object'] };
  }
  const obj = value as Record<string, unknown>;

  if (typeof obj.eventId !== 'string' || obj.eventId.trim().length === 0) {
    errors.push('eventId must be a non-empty string');
  }
  if (typeof obj.groupId !== 'string' || obj.groupId.trim().length === 0) {
    errors.push('groupId must be a non-empty string');
  }
  if (typeof obj.summary !== 'string' || obj.summary.trim().length === 0) {
    errors.push('summary must be a non-empty string');
  }
  if (obj.description !== undefined && typeof obj.description !== 'string') {
    errors.push('description must be a string if provided');
  }
  if (obj.location !== undefined && typeof obj.location !== 'string') {
    errors.push('location must be a string if provided');
  }

  let startParsed: number | null = null;
  let endParsed: number | null = null;

  if (!isValidIsoDateString(obj.startTime)) {
    errors.push('startTime must be a valid ISO 8601 date string');
  } else {
    startParsed = Date.parse(obj.startTime as string);
  }

  if (!isValidIsoDateString(obj.endTime)) {
    errors.push('endTime must be a valid ISO 8601 date string');
  } else {
    endParsed = Date.parse(obj.endTime as string);
  }

  if (startParsed !== null && endParsed !== null && startParsed > endParsed) {
    errors.push('startTime cannot be after endTime');
  }

  if (obj.recurrenceRule !== undefined) {
    if (!isValidRruleString(obj.recurrenceRule)) {
      errors.push(
        'recurrenceRule must be a valid RFC 5545 RRULE string (e.g., FREQ=WEEKLY;INTERVAL=1)',
      );
    }
  }

  if (obj.manifestSummary !== undefined) {
    const summaryValidation = validateCalendarManifestSummaryV1(obj.manifestSummary);
    if (!summaryValidation.valid) {
      errors.push(...summaryValidation.errors.map((e) => `manifestSummary.${e}`));
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Type guard for CalendarScheduleExportContractV1.
 */
export function isCalendarScheduleExportContractV1(
  value: unknown,
): value is CalendarScheduleExportContractV1 {
  return validateCalendarScheduleExportContractV1(value).valid;
}

/**
 * Factory helper for creating CalendarScheduleExportContractV1.
 */
export function createCalendarScheduleExportContractV1(
  input: CalendarScheduleExportContractV1,
): CalendarScheduleExportContractV1 {
  const validation = validateCalendarScheduleExportContractV1(input);
  if (!validation.valid) {
    throw new Error(
      `Failed to create CalendarScheduleExportContractV1: ${validation.errors.join('; ')}`,
    );
  }
  return { ...input };
}
