/**
 * Equipment Manifest Published Language Contract (V1)
 *
 * Defines the public contract for equipment manifests exchanged between
 * domains (event planning, inventory, packing sessions) and external consumers.
 */

export const EQUIPMENT_COVERAGE_STATUSES = [
  'UNASSIGNED',
  'PARTIALLY_COVERED',
  'COVERED',
  'PACKED',
  'MISSING',
] as const;

export type EquipmentCoverageStatus = (typeof EQUIPMENT_COVERAGE_STATUSES)[number];

export interface EquipmentManifestCustodianV1 {
  userId: string;
  name?: string;
}

export interface EquipmentManifestItemV1 {
  itemId: string;
  name: string;
  category: string;
  requiredQuantity: number;
  committedQuantity: number;
  packedQuantity: number;
  coverageStatus: EquipmentCoverageStatus;
  primaryCustodian?: EquipmentManifestCustodianV1;
}

export interface EquipmentManifestContractV1 {
  manifestId: string;
  activityId: string;
  groupId: string;
  title: string;
  itemCount: number;
  overallCoveragePercent: number;
  items: EquipmentManifestItemV1[];
}

export interface ContractValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Type guard for EquipmentCoverageStatus.
 */
export function isEquipmentCoverageStatus(value: unknown): value is EquipmentCoverageStatus {
  return (
    typeof value === 'string' &&
    EQUIPMENT_COVERAGE_STATUSES.includes(value as EquipmentCoverageStatus)
  );
}

/**
 * Validates an EquipmentManifestCustodianV1 object.
 */
export function validateEquipmentManifestCustodianV1(value: unknown): ContractValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['Custodian must be a non-null object'] };
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj.userId !== 'string' || obj.userId.trim().length === 0) {
    errors.push('userId must be a non-empty string');
  }
  if (obj.name !== undefined && (typeof obj.name !== 'string' || obj.name.trim().length === 0)) {
    errors.push('name must be a non-empty string if provided');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Type guard for EquipmentManifestCustodianV1.
 */
export function isEquipmentManifestCustodianV1(
  value: unknown,
): value is EquipmentManifestCustodianV1 {
  return validateEquipmentManifestCustodianV1(value).valid;
}

/**
 * Validates an EquipmentManifestItemV1 object.
 */
export function validateEquipmentManifestItemV1(value: unknown): ContractValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['Item must be a non-null object'] };
  }
  const obj = value as Record<string, unknown>;

  if (typeof obj.itemId !== 'string' || obj.itemId.trim().length === 0) {
    errors.push('itemId must be a non-empty string');
  }
  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
    errors.push('name must be a non-empty string');
  }
  if (typeof obj.category !== 'string' || obj.category.trim().length === 0) {
    errors.push('category must be a non-empty string');
  }
  if (
    typeof obj.requiredQuantity !== 'number' ||
    !Number.isFinite(obj.requiredQuantity) ||
    obj.requiredQuantity < 0
  ) {
    errors.push('requiredQuantity must be a non-negative number');
  }
  if (
    typeof obj.committedQuantity !== 'number' ||
    !Number.isFinite(obj.committedQuantity) ||
    obj.committedQuantity < 0
  ) {
    errors.push('committedQuantity must be a non-negative number');
  }
  if (
    typeof obj.packedQuantity !== 'number' ||
    !Number.isFinite(obj.packedQuantity) ||
    obj.packedQuantity < 0
  ) {
    errors.push('packedQuantity must be a non-negative number');
  }
  if (!isEquipmentCoverageStatus(obj.coverageStatus)) {
    errors.push(`coverageStatus must be one of: ${EQUIPMENT_COVERAGE_STATUSES.join(', ')}`);
  }
  if (obj.primaryCustodian !== undefined) {
    const custodianValidation = validateEquipmentManifestCustodianV1(obj.primaryCustodian);
    if (!custodianValidation.valid) {
      errors.push(...custodianValidation.errors.map((e) => `primaryCustodian.${e}`));
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Type guard for EquipmentManifestItemV1.
 */
export function isEquipmentManifestItemV1(value: unknown): value is EquipmentManifestItemV1 {
  return validateEquipmentManifestItemV1(value).valid;
}

/**
 * Validates an EquipmentManifestContractV1 object.
 */
export function validateEquipmentManifestContractV1(value: unknown): ContractValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['Manifest contract must be a non-null object'] };
  }
  const obj = value as Record<string, unknown>;

  if (typeof obj.manifestId !== 'string' || obj.manifestId.trim().length === 0) {
    errors.push('manifestId must be a non-empty string');
  }
  if (typeof obj.activityId !== 'string' || obj.activityId.trim().length === 0) {
    errors.push('activityId must be a non-empty string');
  }
  if (typeof obj.groupId !== 'string' || obj.groupId.trim().length === 0) {
    errors.push('groupId must be a non-empty string');
  }
  if (typeof obj.title !== 'string' || obj.title.trim().length === 0) {
    errors.push('title must be a non-empty string');
  }
  if (
    typeof obj.itemCount !== 'number' ||
    !Number.isInteger(obj.itemCount) ||
    obj.itemCount < 0
  ) {
    errors.push('itemCount must be a non-negative integer');
  }
  if (
    typeof obj.overallCoveragePercent !== 'number' ||
    !Number.isFinite(obj.overallCoveragePercent) ||
    obj.overallCoveragePercent < 0 ||
    obj.overallCoveragePercent > 100
  ) {
    errors.push('overallCoveragePercent must be a number between 0 and 100');
  }
  if (!Array.isArray(obj.items)) {
    errors.push('items must be an array');
  } else {
    obj.items.forEach((item, index) => {
      const itemValidation = validateEquipmentManifestItemV1(item);
      if (!itemValidation.valid) {
        errors.push(...itemValidation.errors.map((e) => `items[${index}].${e}`));
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Type guard for EquipmentManifestContractV1.
 */
export function isEquipmentManifestContractV1(
  value: unknown,
): value is EquipmentManifestContractV1 {
  return validateEquipmentManifestContractV1(value).valid;
}

/**
 * Automatically computes coverage status based on quantities and missing status.
 */
export function calculateEquipmentCoverageStatus(
  required: number,
  committed: number,
  packed: number,
  isMissing = false,
): EquipmentCoverageStatus {
  if (isMissing) return 'MISSING';
  if (required <= 0) return 'COVERED';
  if (packed >= required) return 'PACKED';
  if (committed >= required) return 'COVERED';
  if (committed > 0) return 'PARTIALLY_COVERED';
  return 'UNASSIGNED';
}

/**
 * Input parameters for creating an EquipmentManifestItemV1.
 */
export interface CreateEquipmentManifestItemInput {
  itemId: string;
  name: string;
  category: string;
  requiredQuantity?: number;
  committedQuantity?: number;
  packedQuantity?: number;
  coverageStatus?: EquipmentCoverageStatus;
  isMissing?: boolean;
  primaryCustodian?: EquipmentManifestCustodianV1;
}

/**
 * Factory helper for creating a validated EquipmentManifestItemV1.
 */
export function createEquipmentManifestItemV1(
  input: CreateEquipmentManifestItemInput,
): EquipmentManifestItemV1 {
  const requiredQuantity = input.requiredQuantity ?? 1;
  const committedQuantity = input.committedQuantity ?? 0;
  const packedQuantity = input.packedQuantity ?? 0;
  const coverageStatus =
    input.coverageStatus ??
    calculateEquipmentCoverageStatus(
      requiredQuantity,
      committedQuantity,
      packedQuantity,
      input.isMissing ?? false,
    );

  const item: EquipmentManifestItemV1 = {
    itemId: input.itemId,
    name: input.name,
    category: input.category,
    requiredQuantity,
    committedQuantity,
    packedQuantity,
    coverageStatus,
    ...(input.primaryCustodian ? { primaryCustodian: input.primaryCustodian } : {}),
  };

  const validation = validateEquipmentManifestItemV1(item);
  if (!validation.valid) {
    throw new Error(`Failed to create EquipmentManifestItemV1: ${validation.errors.join('; ')}`);
  }

  return item;
}

/**
 * Input parameters for creating an EquipmentManifestContractV1.
 */
export interface CreateEquipmentManifestInput {
  manifestId: string;
  activityId: string;
  groupId: string;
  title: string;
  itemCount?: number;
  overallCoveragePercent?: number;
  items?: EquipmentManifestItemV1[];
}

/**
 * Factory helper for creating a validated EquipmentManifestContractV1.
 */
export function createEquipmentManifestContractV1(
  input: CreateEquipmentManifestInput,
): EquipmentManifestContractV1 {
  const items = input.items ?? [];
  const itemCount = input.itemCount ?? items.length;

  let overallCoveragePercent = input.overallCoveragePercent;
  if (overallCoveragePercent === undefined) {
    if (items.length === 0) {
      overallCoveragePercent = 100;
    } else {
      const totalRequired = items.reduce((sum, it) => sum + it.requiredQuantity, 0);
      const totalCommitted = items.reduce(
        (sum, it) => sum + Math.min(it.committedQuantity, it.requiredQuantity),
        0,
      );
      overallCoveragePercent =
        totalRequired > 0 ? Math.round((totalCommitted / totalRequired) * 100) : 100;
    }
  }

  const manifest: EquipmentManifestContractV1 = {
    manifestId: input.manifestId,
    activityId: input.activityId,
    groupId: input.groupId,
    title: input.title,
    itemCount,
    overallCoveragePercent,
    items,
  };

  const validation = validateEquipmentManifestContractV1(manifest);
  if (!validation.valid) {
    throw new Error(
      `Failed to create EquipmentManifestContractV1: ${validation.errors.join('; ')}`,
    );
  }

  return manifest;
}
