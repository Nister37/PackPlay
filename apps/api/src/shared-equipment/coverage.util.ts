import { SharedResponsibilityStatus } from '@prisma/client';

export enum CoverageStatus {
  UNASSIGNED = 'UNASSIGNED',
  PARTIALLY_COVERED = 'PARTIALLY_COVERED',
  COVERED = 'COVERED',
  PACKED = 'PACKED',
  MISSING = 'MISSING',
  REPLACEMENT_PENDING = 'REPLACEMENT_PENDING',
  REPLACEMENT_FOUND = 'REPLACEMENT_FOUND',
}

export interface ResponsibilityData {
  committedQuantity: number;
  packedQuantity: number;
  extraQuantity: number;
  status: SharedResponsibilityStatus;
}

export interface CoverageResult {
  requiredQuantity: number;
  committedQuantity: number;
  packedQuantity: number;
  extraQuantity: number;
  uncoveredQuantity: number;
  status: CoverageStatus;
}

export function calculateCoverage(
  requiredQuantity: number,
  responsibilities: ResponsibilityData[],
): CoverageResult {
  const activeStatuses: SharedResponsibilityStatus[] = [
    SharedResponsibilityStatus.COMMITTED,
    SharedResponsibilityStatus.PACKED,
  ];

  const activeResponsibilities = responsibilities.filter((r) =>
    activeStatuses.includes(r.status),
  );

  const committedQuantity = activeResponsibilities.reduce(
    (sum, r) => sum + r.committedQuantity,
    0,
  );

  const packedQuantity = responsibilities
    .filter((r) => r.status === SharedResponsibilityStatus.PACKED)
    .reduce((sum, r) => sum + r.packedQuantity, 0);

  const extraQuantity = responsibilities.reduce((sum, r) => sum + r.extraQuantity, 0);

  const uncoveredQuantity = Math.max(0, requiredQuantity - committedQuantity);

  const hasMissing = responsibilities.some(
    (r) =>
      r.status === SharedResponsibilityStatus.FORGOT ||
      r.status === SharedResponsibilityStatus.COULD_NOT_BRING,
  );

  const hasReplacementArranged = responsibilities.some(
    (r) => r.status === SharedResponsibilityStatus.REPLACEMENT_ARRANGED,
  );

  let status: CoverageStatus;

  if (hasMissing && hasReplacementArranged) {
    status = CoverageStatus.REPLACEMENT_FOUND;
  } else if (hasMissing) {
    status = CoverageStatus.REPLACEMENT_PENDING;
  } else if (responsibilities.length === 0) {
    status = CoverageStatus.UNASSIGNED;
  } else if (packedQuantity >= requiredQuantity) {
    status = CoverageStatus.PACKED;
  } else if (committedQuantity >= requiredQuantity) {
    status = CoverageStatus.COVERED;
  } else {
    status = CoverageStatus.PARTIALLY_COVERED;
  }

  return {
    requiredQuantity,
    committedQuantity,
    packedQuantity,
    extraQuantity,
    uncoveredQuantity,
    status,
  };
}
