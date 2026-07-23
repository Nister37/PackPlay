import { SharedResponsibilityStatus } from '@prisma/client';
import { calculateCoverage, CoverageStatus } from './coverage.util';

describe('calculateCoverage', () => {
  it('should return UNASSIGNED when no responsibilities exist', () => {
    const result = calculateCoverage(3, []);

    expect(result.status).toBe(CoverageStatus.UNASSIGNED);
    expect(result.committedQuantity).toBe(0);
    expect(result.packedQuantity).toBe(0);
    expect(result.extraQuantity).toBe(0);
    expect(result.uncoveredQuantity).toBe(3);
  });

  it('should return PARTIALLY_COVERED when committed < required', () => {
    const result = calculateCoverage(3, [
      {
        committedQuantity: 1,
        packedQuantity: 0,
        extraQuantity: 0,
        status: SharedResponsibilityStatus.COMMITTED,
      },
    ]);

    expect(result.status).toBe(CoverageStatus.PARTIALLY_COVERED);
    expect(result.committedQuantity).toBe(1);
    expect(result.uncoveredQuantity).toBe(2);
  });

  it('should return COVERED when committed >= required but not packed', () => {
    const result = calculateCoverage(2, [
      {
        committedQuantity: 1,
        packedQuantity: 0,
        extraQuantity: 0,
        status: SharedResponsibilityStatus.COMMITTED,
      },
      {
        committedQuantity: 1,
        packedQuantity: 0,
        extraQuantity: 0,
        status: SharedResponsibilityStatus.COMMITTED,
      },
    ]);

    expect(result.status).toBe(CoverageStatus.COVERED);
    expect(result.committedQuantity).toBe(2);
    expect(result.uncoveredQuantity).toBe(0);
  });

  it('should return PACKED when packed >= required', () => {
    const result = calculateCoverage(2, [
      {
        committedQuantity: 2,
        packedQuantity: 2,
        extraQuantity: 0,
        status: SharedResponsibilityStatus.PACKED,
      },
    ]);

    expect(result.status).toBe(CoverageStatus.PACKED);
    expect(result.packedQuantity).toBe(2);
  });

  it('should return REPLACEMENT_PENDING when someone forgot and no replacement', () => {
    const result = calculateCoverage(2, [
      {
        committedQuantity: 1,
        packedQuantity: 0,
        extraQuantity: 0,
        status: SharedResponsibilityStatus.FORGOT,
      },
      {
        committedQuantity: 1,
        packedQuantity: 1,
        extraQuantity: 0,
        status: SharedResponsibilityStatus.PACKED,
      },
    ]);

    expect(result.status).toBe(CoverageStatus.REPLACEMENT_PENDING);
  });

  it('should return REPLACEMENT_FOUND when missing + replacement arranged', () => {
    const result = calculateCoverage(2, [
      {
        committedQuantity: 1,
        packedQuantity: 0,
        extraQuantity: 0,
        status: SharedResponsibilityStatus.COULD_NOT_BRING,
      },
      {
        committedQuantity: 1,
        packedQuantity: 0,
        extraQuantity: 0,
        status: SharedResponsibilityStatus.REPLACEMENT_ARRANGED,
      },
    ]);

    expect(result.status).toBe(CoverageStatus.REPLACEMENT_FOUND);
  });

  it('combines personal commitments and inventory reservations without double counting', () => {
    const result = calculateCoverage(
      5,
      [
        {
          committedQuantity: 2,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
      ],
      3,
    );

    expect(result.status).toBe(CoverageStatus.COVERED);
    expect(result.committedQuantity).toBe(5);
    expect(result.personalCommittedQuantity).toBe(2);
    expect(result.inventoryReservedQuantity).toBe(3);
    expect(result.uncoveredQuantity).toBe(0);
  });

  it('should not count RELEASED responsibilities in committed total', () => {
    const result = calculateCoverage(2, [
      {
        committedQuantity: 1,
        packedQuantity: 0,
        extraQuantity: 0,
        status: SharedResponsibilityStatus.RELEASED,
      },
      {
        committedQuantity: 1,
        packedQuantity: 0,
        extraQuantity: 0,
        status: SharedResponsibilityStatus.COMMITTED,
      },
    ]);

    expect(result.status).toBe(CoverageStatus.PARTIALLY_COVERED);
    expect(result.committedQuantity).toBe(1);
    expect(result.uncoveredQuantity).toBe(1);
  });

  it('should sum extra quantities across all responsibilities', () => {
    const result = calculateCoverage(1, [
      {
        committedQuantity: 1,
        packedQuantity: 1,
        extraQuantity: 2,
        status: SharedResponsibilityStatus.PACKED,
      },
      {
        committedQuantity: 0,
        packedQuantity: 0,
        extraQuantity: 1,
        status: SharedResponsibilityStatus.RELEASED,
      },
    ]);

    expect(result.extraQuantity).toBe(3);
  });

  it('should ensure uncoveredQuantity is never negative', () => {
    const result = calculateCoverage(1, [
      {
        committedQuantity: 5,
        packedQuantity: 0,
        extraQuantity: 0,
        status: SharedResponsibilityStatus.COMMITTED,
      },
    ]);

    expect(result.uncoveredQuantity).toBe(0);
    expect(result.committedQuantity).toBe(5);
  });
});
