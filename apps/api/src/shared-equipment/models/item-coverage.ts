import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SharedResponsibilityStatus } from '@prisma/client';
import { AppErrorCode } from '@packplay/common';

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
  userId?: string;
  committedQuantity: number;
  packedQuantity: number;
  extraQuantity: number;
  status: SharedResponsibilityStatus;
}

export interface CoverageResult {
  requiredQuantity: number;
  committedQuantity: number;
  personalCommittedQuantity: number;
  inventoryReservedQuantity: number;
  packedQuantity: number;
  extraQuantity: number;
  uncoveredQuantity: number;
  status: CoverageStatus;
}

export interface InvariantViolation {
  code: AppErrorCode;
  message: string;
}

export class ItemCoverage {
  private _requiredQuantity: number;
  private _responsibilities: ResponsibilityData[];
  private _inventoryReservedQuantity: number;

  private _personalCommittedQuantity = 0;
  private _committedQuantity = 0;
  private _packedQuantity = 0;
  private _extraQuantity = 0;
  private _uncoveredQuantity = 0;
  private _status: CoverageStatus = CoverageStatus.UNASSIGNED;

  constructor(
    requiredQuantity: number,
    responsibilities: ResponsibilityData[] = [],
    inventoryReservedQuantity = 0,
  ) {
    this._requiredQuantity = Math.max(0, requiredQuantity);
    this._responsibilities = [...responsibilities];
    this._inventoryReservedQuantity = Math.max(0, inventoryReservedQuantity);
    this.calculate();
  }

  static fromItem(
    requiredQuantity: number,
    responsibilities: ResponsibilityData[] = [],
    inventoryReservedQuantity = 0,
  ): ItemCoverage {
    return new ItemCoverage(requiredQuantity, responsibilities, inventoryReservedQuantity);
  }

  static calculate(
    requiredQuantity: number,
    responsibilities: ResponsibilityData[] = [],
    inventoryReservedQuantity = 0,
  ): CoverageResult {
    const coverage = new ItemCoverage(
      requiredQuantity,
      responsibilities,
      inventoryReservedQuantity,
    );
    return coverage.toResult();
  }

  // ─── Calculation & Invariant State ────────────────────────────────────

  calculate(): CoverageResult {
    const activeStatuses: SharedResponsibilityStatus[] = [
      SharedResponsibilityStatus.COMMITTED,
      SharedResponsibilityStatus.PACKED,
    ];

    const activeResponsibilities = this._responsibilities.filter((r) =>
      activeStatuses.includes(r.status),
    );

    this._personalCommittedQuantity = activeResponsibilities.reduce(
      (sum, r) => sum + (r.committedQuantity ?? 0),
      0,
    );
    this._committedQuantity =
      this._personalCommittedQuantity + this._inventoryReservedQuantity;

    this._packedQuantity = this._responsibilities
      .filter((r) => r.status === SharedResponsibilityStatus.PACKED)
      .reduce((sum, r) => sum + (r.packedQuantity ?? 0), 0);

    this._extraQuantity = this._responsibilities.reduce(
      (sum, r) => sum + (r.extraQuantity ?? 0),
      0,
    );

    this._uncoveredQuantity = Math.max(
      0,
      this._requiredQuantity - this._committedQuantity,
    );

    const hasMissing = this._responsibilities.some(
      (r) =>
        r.status === SharedResponsibilityStatus.FORGOT ||
        r.status === SharedResponsibilityStatus.COULD_NOT_BRING,
    );

    const hasReplacementArranged = this._responsibilities.some(
      (r) => r.status === SharedResponsibilityStatus.REPLACEMENT_ARRANGED,
    );

    if (hasMissing && hasReplacementArranged) {
      this._status = CoverageStatus.REPLACEMENT_FOUND;
    } else if (hasMissing) {
      this._status = CoverageStatus.REPLACEMENT_PENDING;
    } else if (
      this._responsibilities.length === 0 &&
      this._inventoryReservedQuantity === 0
    ) {
      this._status = CoverageStatus.UNASSIGNED;
    } else if (this._packedQuantity >= this._requiredQuantity) {
      this._status = CoverageStatus.PACKED;
    } else if (this._committedQuantity >= this._requiredQuantity) {
      this._status = CoverageStatus.COVERED;
    } else {
      this._status = CoverageStatus.PARTIALLY_COVERED;
    }

    return this.toResult();
  }

  toResult(): CoverageResult {
    return {
      requiredQuantity: this._requiredQuantity,
      committedQuantity: this._committedQuantity,
      personalCommittedQuantity: this._personalCommittedQuantity,
      inventoryReservedQuantity: this._inventoryReservedQuantity,
      packedQuantity: this._packedQuantity,
      extraQuantity: this._extraQuantity,
      uncoveredQuantity: this._uncoveredQuantity,
      status: this._status,
    };
  }

  // ─── Getters ──────────────────────────────────────────────────────────

  get requiredQuantity(): number {
    return this._requiredQuantity;
  }

  get committedQuantity(): number {
    return this._committedQuantity;
  }

  get personalCommittedQuantity(): number {
    return this._personalCommittedQuantity;
  }

  get inventoryReservedQuantity(): number {
    return this._inventoryReservedQuantity;
  }

  get packedQuantity(): number {
    return this._packedQuantity;
  }

  get extraQuantity(): number {
    return this._extraQuantity;
  }

  get uncoveredQuantity(): number {
    return this._uncoveredQuantity;
  }

  get status(): CoverageStatus {
    return this._status;
  }

  get responsibilities(): readonly ResponsibilityData[] {
    return this._responsibilities;
  }

  get isFullyCovered(): boolean {
    return this._committedQuantity >= this._requiredQuantity;
  }

  get isFullyPacked(): boolean {
    return this._packedQuantity >= this._requiredQuantity;
  }

  get missingResponsibilities(): ResponsibilityData[] {
    return this._responsibilities.filter(
      (r) =>
        r.status === SharedResponsibilityStatus.FORGOT ||
        r.status === SharedResponsibilityStatus.COULD_NOT_BRING,
    );
  }

  get hasMissingResponsibilities(): boolean {
    return this.missingResponsibilities.length > 0;
  }

  get activeResponsibilities(): ResponsibilityData[] {
    return this._responsibilities.filter(
      (r) =>
        r.status === SharedResponsibilityStatus.COMMITTED ||
        r.status === SharedResponsibilityStatus.PACKED,
    );
  }

  // ─── Invariant Validation Methods ─────────────────────────────────────

  getClaimViolation(
    userId: string,
    quantity: number,
  ): InvariantViolation | null {
    if (quantity < 1) {
      return {
        code: AppErrorCode.INVALID_QUANTITY,
        message: 'Quantity must be at least 1',
      };
    }

    const hasActive = this._responsibilities.some(
      (r) =>
        r.userId === userId &&
        (r.status === SharedResponsibilityStatus.COMMITTED ||
          r.status === SharedResponsibilityStatus.PACKED),
    );

    if (hasActive) {
      return {
        code: AppErrorCode.ALREADY_CLAIMED,
        message: 'You have already claimed this item',
      };
    }

    if (this._committedQuantity + quantity > this._requiredQuantity) {
      return {
        code: AppErrorCode.SHARED_ITEM_ALREADY_COVERED,
        message: 'Claiming this quantity would exceed the required amount',
      };
    }

    return null;
  }

  canClaim(userId: string, quantity: number): boolean {
    return this.getClaimViolation(userId, quantity) === null;
  }

  assertCanClaim(userId: string, quantity: number): void {
    const violation = this.getClaimViolation(userId, quantity);
    if (violation) {
      if (violation.code === AppErrorCode.INVALID_QUANTITY) {
        throw new BadRequestException(violation);
      }
      throw new ConflictException(violation);
    }
  }

  getPackViolation(
    userId: string,
    quantity?: number,
  ): InvariantViolation | null {
    const resp =
      this._responsibilities.find((r) => r.userId === userId) ??
      (this._responsibilities.length === 1 && !this._responsibilities[0].userId
        ? this._responsibilities[0]
        : undefined);
    if (!resp) {
      return {
        code: AppErrorCode.RESPONSIBILITY_NOT_FOUND,
        message: 'No responsibility found for this item',
      };
    }

    if (
      resp.status !== SharedResponsibilityStatus.COMMITTED &&
      resp.status !== SharedResponsibilityStatus.PACKED
    ) {
      return {
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Cannot pack a responsibility that is not committed',
      };
    }

    if (
      quantity !== undefined &&
      (quantity <= 0 || quantity > resp.committedQuantity)
    ) {
      return {
        code: AppErrorCode.INVALID_QUANTITY,
        message: 'Quantity must be between 1 and the committed quantity',
      };
    }

    return null;
  }

  canPack(userId: string, quantity?: number): boolean {
    return this.getPackViolation(userId, quantity) === null;
  }

  assertCanPack(userId: string, quantity?: number): void {
    const violation = this.getPackViolation(userId, quantity);
    if (violation) {
      if (violation.code === AppErrorCode.RESPONSIBILITY_NOT_FOUND) {
        throw new NotFoundException(violation);
      }
      throw new BadRequestException(violation);
    }
  }

  getReleaseViolation(userId: string): InvariantViolation | null {
    const resp =
      this._responsibilities.find((r) => r.userId === userId) ??
      (this._responsibilities.length === 1 && !this._responsibilities[0].userId
        ? this._responsibilities[0]
        : undefined);
    if (!resp) {
      return {
        code: AppErrorCode.RESPONSIBILITY_NOT_FOUND,
        message: 'No responsibility found for this item',
      };
    }

    if (resp.status === SharedResponsibilityStatus.PACKED) {
      return {
        code: AppErrorCode.CANNOT_RELEASE_PACKED,
        message: 'Cannot release a responsibility that is already packed',
      };
    }

    if (resp.status === SharedResponsibilityStatus.RELEASED) {
      return {
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Responsibility is already released',
      };
    }

    return null;
  }

  canRelease(userId: string): boolean {
    return this.getReleaseViolation(userId) === null;
  }

  assertCanRelease(userId: string): void {
    const violation = this.getReleaseViolation(userId);
    if (violation) {
      if (violation.code === AppErrorCode.RESPONSIBILITY_NOT_FOUND) {
        throw new NotFoundException(violation);
      }
      throw new BadRequestException(violation);
    }
  }

  getTakeOverViolation(
    userId: string,
    quantity = 1,
  ): InvariantViolation | null {
    if (quantity < 1) {
      return {
        code: AppErrorCode.INVALID_QUANTITY,
        message: 'Quantity must be at least 1',
      };
    }

    const missingResponsibilities = this._responsibilities.filter(
      (r) =>
        r.status === SharedResponsibilityStatus.FORGOT ||
        r.status === SharedResponsibilityStatus.COULD_NOT_BRING,
    );

    if (missingResponsibilities.length === 0) {
      return {
        code: AppErrorCode.CANNOT_TAKE_OVER_COVERED,
        message: 'No missing responsibilities to take over',
      };
    }

    return null;
  }

  canTakeOver(userId: string, quantity = 1): boolean {
    return this.getTakeOverViolation(userId, quantity) === null;
  }

  assertCanTakeOver(userId: string, quantity = 1): void {
    const violation = this.getTakeOverViolation(userId, quantity);
    if (violation) {
      throw new BadRequestException(violation);
    }
  }

  getTransferViolation(
    fromUserId: string,
    toUserId: string,
    quantity?: number,
  ): InvariantViolation | null {
    if (fromUserId === toUserId) {
      return {
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Responsibility must be transferred to another member',
      };
    }

    const source =
      this._responsibilities.find((r) => r.userId === fromUserId) ??
      (this._responsibilities.length >= 1 && !this._responsibilities[0].userId
        ? this._responsibilities[0]
        : undefined);
    if (!source) {
      return {
        code: AppErrorCode.RESPONSIBILITY_NOT_FOUND,
        message: 'No responsibility found for this item',
      };
    }

    if (source.status !== SharedResponsibilityStatus.COMMITTED) {
      return {
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Only committed responsibilities can be transferred',
      };
    }

    const targetExisting = this._responsibilities.find(
      (r) =>
        r.userId === toUserId &&
        (r.status === SharedResponsibilityStatus.COMMITTED ||
          r.status === SharedResponsibilityStatus.PACKED),
    );

    if (targetExisting) {
      return {
        code: AppErrorCode.ALREADY_CLAIMED,
        message: 'Target user already has an active responsibility for this item',
      };
    }

    const transferQuantity = quantity ?? source.committedQuantity;
    if (transferQuantity < 1) {
      return {
        code: AppErrorCode.INVALID_QUANTITY,
        message: 'Quantity must be at least 1',
      };
    }

    if (transferQuantity > source.committedQuantity) {
      return {
        code: AppErrorCode.VALIDATION_ERROR,
        message: 'Transfer quantity exceeds current responsibility',
      };
    }

    return null;
  }

  canTransfer(
    fromUserId: string,
    toUserId: string,
    quantity?: number,
  ): boolean {
    return this.getTransferViolation(fromUserId, toUserId, quantity) === null;
  }

  assertCanTransfer(
    fromUserId: string,
    toUserId: string,
    quantity?: number,
  ): void {
    const violation = this.getTransferViolation(fromUserId, toUserId, quantity);
    if (violation) {
      if (violation.code === AppErrorCode.RESPONSIBILITY_NOT_FOUND) {
        throw new NotFoundException(violation);
      }
      if (violation.code === AppErrorCode.ALREADY_CLAIMED) {
        throw new ConflictException(violation);
      }
      throw new BadRequestException(violation);
    }
  }
}
