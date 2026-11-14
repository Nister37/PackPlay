import { SharedResponsibilityStatus } from '@prisma/client';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ItemCoverage, CoverageStatus } from './item-coverage';

describe('ItemCoverage domain model', () => {
  describe('calculation and status transitions', () => {
    it('returns UNASSIGNED when there are no responsibilities and no inventory', () => {
      const coverage = new ItemCoverage(3, []);
      expect(coverage.status).toBe(CoverageStatus.UNASSIGNED);
      expect(coverage.committedQuantity).toBe(0);
      expect(coverage.uncoveredQuantity).toBe(3);
    });

    it('returns PARTIALLY_COVERED when committed is less than required', () => {
      const coverage = new ItemCoverage(5, [
        {
          userId: 'u1',
          committedQuantity: 2,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
      ]);
      expect(coverage.status).toBe(CoverageStatus.PARTIALLY_COVERED);
      expect(coverage.committedQuantity).toBe(2);
      expect(coverage.uncoveredQuantity).toBe(3);
      expect(coverage.isFullyCovered).toBe(false);
    });

    it('returns COVERED when committed reaches required', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 2,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
      ]);
      expect(coverage.status).toBe(CoverageStatus.COVERED);
      expect(coverage.uncoveredQuantity).toBe(0);
      expect(coverage.isFullyCovered).toBe(true);
    });

    it('includes inventoryReservedQuantity in committedQuantity', () => {
      const coverage = new ItemCoverage(
        4,
        [
          {
            userId: 'u1',
            committedQuantity: 2,
            packedQuantity: 0,
            extraQuantity: 0,
            status: SharedResponsibilityStatus.COMMITTED,
          },
        ],
        2,
      );
      expect(coverage.committedQuantity).toBe(4);
      expect(coverage.personalCommittedQuantity).toBe(2);
      expect(coverage.inventoryReservedQuantity).toBe(2);
      expect(coverage.status).toBe(CoverageStatus.COVERED);
    });

    it('returns PACKED when packed quantity reaches required', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 2,
          packedQuantity: 2,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.PACKED,
        },
      ]);
      expect(coverage.status).toBe(CoverageStatus.PACKED);
      expect(coverage.isFullyPacked).toBe(true);
    });

    it('returns REPLACEMENT_PENDING when any responsibility is missing', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.FORGOT,
        },
      ]);
      expect(coverage.status).toBe(CoverageStatus.REPLACEMENT_PENDING);
    });

    it('returns REPLACEMENT_FOUND when missing responsibility has a replacement arranged', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.FORGOT,
        },
        {
          userId: 'u2',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.REPLACEMENT_ARRANGED,
        },
      ]);
      expect(coverage.status).toBe(CoverageStatus.REPLACEMENT_FOUND);
    });
  });

  describe('canClaim and assertCanClaim', () => {
    it('allows valid claim when within required quantity', () => {
      const coverage = new ItemCoverage(3, []);
      expect(coverage.canClaim('u1', 2)).toBe(true);
      expect(() => coverage.assertCanClaim('u1', 2)).not.toThrow();
    });

    it('rejects claim with quantity less than 1', () => {
      const coverage = new ItemCoverage(3, []);
      expect(coverage.canClaim('u1', 0)).toBe(false);
      expect(() => coverage.assertCanClaim('u1', 0)).toThrow(BadRequestException);
    });

    it('rejects claim if user already has an active responsibility', () => {
      const coverage = new ItemCoverage(3, [
        {
          userId: 'u1',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
      ]);
      expect(coverage.canClaim('u1', 1)).toBe(false);
      expect(() => coverage.assertCanClaim('u1', 1)).toThrow(ConflictException);
    });

    it('rejects claim if quantity exceeds required amount', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
      ]);
      expect(coverage.canClaim('u2', 2)).toBe(false);
      expect(() => coverage.assertCanClaim('u2', 2)).toThrow(ConflictException);
    });
  });

  describe('canPack and assertCanPack', () => {
    it('allows packing for user with committed responsibility', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
      ]);
      expect(coverage.canPack('u1', 1)).toBe(true);
      expect(() => coverage.assertCanPack('u1', 1)).not.toThrow();
    });

    it('rejects packing if responsibility does not exist', () => {
      const coverage = new ItemCoverage(2, []);
      expect(coverage.canPack('u1')).toBe(false);
      expect(() => coverage.assertCanPack('u1')).toThrow(NotFoundException);
    });

    it('rejects packing with quantity <= 0', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
      ]);
      expect(coverage.canPack('u1', 0)).toBe(false);
      expect(() => coverage.assertCanPack('u1', 0)).toThrow(BadRequestException);
    });

    it('rejects packing with quantity > committedQuantity', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 2,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
      ]);
      expect(coverage.canPack('u1', 5)).toBe(false);
      expect(() => coverage.assertCanPack('u1', 5)).toThrow(BadRequestException);
    });

    it('rejects packing if status is not COMMITTED or PACKED', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 2,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.RELEASED,
        },
      ]);
      expect(coverage.canPack('u1', 1)).toBe(false);
      expect(() => coverage.assertCanPack('u1', 1)).toThrow(BadRequestException);
    });
  });

  describe('canRelease and assertCanRelease', () => {
    it('allows releasing committed responsibility', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
      ]);
      expect(coverage.canRelease('u1')).toBe(true);
      expect(() => coverage.assertCanRelease('u1')).not.toThrow();
    });

    it('rejects releasing a packed responsibility', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 1,
          packedQuantity: 1,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.PACKED,
        },
      ]);
      expect(coverage.canRelease('u1')).toBe(false);
      expect(() => coverage.assertCanRelease('u1')).toThrow(BadRequestException);
    });

    it('rejects releasing if responsibility not found', () => {
      const coverage = new ItemCoverage(2, []);
      expect(coverage.canRelease('u1')).toBe(false);
      expect(() => coverage.assertCanRelease('u1')).toThrow(NotFoundException);
    });

    it('rejects releasing if responsibility is already released', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 0,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.RELEASED,
        },
      ]);
      expect(coverage.canRelease('u1')).toBe(false);
      expect(() => coverage.assertCanRelease('u1')).toThrow(BadRequestException);
    });
  });

  describe('canTakeOver and assertCanTakeOver', () => {
    it('allows takeover when missing responsibilities exist', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COULD_NOT_BRING,
        },
      ]);
      expect(coverage.canTakeOver('u2', 1)).toBe(true);
      expect(() => coverage.assertCanTakeOver('u2', 1)).not.toThrow();
    });

    it('rejects takeover when no responsibilities are missing', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 2,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
      ]);
      expect(coverage.canTakeOver('u2', 1)).toBe(false);
      expect(() => coverage.assertCanTakeOver('u2', 1)).toThrow(BadRequestException);
    });

    it('rejects takeover with quantity < 1', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.FORGOT,
        },
      ]);
      expect(coverage.canTakeOver('u2', 0)).toBe(false);
      expect(() => coverage.assertCanTakeOver('u2', 0)).toThrow(BadRequestException);
    });
  });

  describe('canTransfer and assertCanTransfer', () => {
    it('allows valid transfer to another member', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 2,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
      ]);
      expect(coverage.canTransfer('u1', 'u2', 1)).toBe(true);
      expect(() => coverage.assertCanTransfer('u1', 'u2', 1)).not.toThrow();
    });

    it('rejects transfer to self', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
      ]);
      expect(coverage.canTransfer('u1', 'u1', 1)).toBe(false);
      expect(() => coverage.assertCanTransfer('u1', 'u1', 1)).toThrow(BadRequestException);
    });

    it('rejects transfer if source not found', () => {
      const coverage = new ItemCoverage(2, []);
      expect(coverage.canTransfer('u1', 'u2', 1)).toBe(false);
      expect(() => coverage.assertCanTransfer('u1', 'u2', 1)).toThrow(NotFoundException);
    });

    it('rejects transfer if target already has active responsibility', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
        {
          userId: 'u2',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
      ]);
      expect(coverage.canTransfer('u1', 'u2', 1)).toBe(false);
      expect(() => coverage.assertCanTransfer('u1', 'u2', 1)).toThrow(ConflictException);
    });

    it('rejects transfer if quantity exceeds source committed quantity', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
      ]);
      expect(coverage.canTransfer('u1', 'u2', 2)).toBe(false);
      expect(() => coverage.assertCanTransfer('u1', 'u2', 2)).toThrow(BadRequestException);
    });

    it('rejects transfer if source status is not COMMITTED', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.RELEASED,
        },
      ]);
      expect(coverage.canTransfer('u1', 'u2', 1)).toBe(false);
      expect(() => coverage.assertCanTransfer('u1', 'u2', 1)).toThrow(BadRequestException);
    });

    it('rejects transfer if transfer quantity < 1', () => {
      const coverage = new ItemCoverage(2, [
        {
          userId: 'u1',
          committedQuantity: 2,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
      ]);
      expect(coverage.canTransfer('u1', 'u2', 0)).toBe(false);
      expect(() => coverage.assertCanTransfer('u1', 'u2', 0)).toThrow(BadRequestException);
    });
  });

  describe('responsibility accessors', () => {
    it('returns missingResponsibilities and activeResponsibilities correctly', () => {
      const coverage = new ItemCoverage(3, [
        {
          userId: 'u1',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.COMMITTED,
        },
        {
          userId: 'u2',
          committedQuantity: 1,
          packedQuantity: 0,
          extraQuantity: 0,
          status: SharedResponsibilityStatus.FORGOT,
        },
      ]);

      expect(coverage.hasMissingResponsibilities).toBe(true);
      expect(coverage.missingResponsibilities).toHaveLength(1);
      expect(coverage.missingResponsibilities[0].userId).toBe('u2');
      expect(coverage.activeResponsibilities).toHaveLength(1);
      expect(coverage.activeResponsibilities[0].userId).toBe('u1');
    });
  });
});
