import type { User } from './auth';
import type { ActivityType } from './groups';

// ─── Re-export Published Language Contracts from @packplay/common ───────────

export {
  EQUIPMENT_COVERAGE_STATUSES,
  type EquipmentCoverageStatus,
  type EquipmentManifestCustodianV1,
  type EquipmentManifestItemV1,
  type EquipmentManifestContractV1,
  type ContractValidationResult,
  isEquipmentCoverageStatus,
  validateEquipmentManifestCustodianV1,
  isEquipmentManifestCustodianV1,
  validateEquipmentManifestItemV1,
  isEquipmentManifestItemV1,
  validateEquipmentManifestContractV1,
  isEquipmentManifestContractV1,
} from '@packplay/common';

// ─── Equipment Core Types ───────────────────────────────────────────────────

export interface SportProfile {
  id: string;
  name: string;
  activityTypes: ActivityType[];
}

export interface EquipmentItem {
  id: string;
  checklistId: string;
  name: string;
  quantity: number;
  category?: string | null;
  isMandatory: boolean;
  notes?: string | null;
  sortOrder: number;
}

export interface PersonalChecklist {
  id: string;
  name: string;
  sportProfileId: string;
  activityType?: ActivityType | null;
  isTemplate: boolean;
  items?: EquipmentItem[];
  _count?: { items: number };
}

export interface SharedItem {
  id: string;
  activityId: string;
  name: string;
  description?: string;
  requiredQuantity: number;
  coveredQuantity: number;
  unit?: string;
  category?: string;
}

export interface CreateSharedItemDto {
  name: string;
  requiredQuantity?: number;
  category?: string;
  isMandatory?: boolean;
  notes?: string;
  catalogueItemId?: string;
}

export interface UpdateSharedItemDto {
  name?: string;
  requiredQuantity?: number;
  category?: string;
  isMandatory?: boolean;
  notes?: string;
}

// ─── Coverage & Responsibilities Types ─────────────────────────────────────

export interface SharedResponsibility {
  id: string;
  sharedItemId: string;
  userId: string;
  quantity: number;
  status:
    | 'COMMITTED'
    | 'PACKED'
    | 'RELEASED'
    | 'FORGOT'
    | 'COULD_NOT_BRING'
    | 'REPLACEMENT_ARRANGED';
  user: User;
}

export interface SharedItemCoverage {
  item: SharedItem;
  responsibilities: SharedResponsibility[];
  coveredQuantity: number;
  missingQuantity: number;
  isCovered: boolean;
  eligibleMembers?: Array<Pick<User, 'id' | 'name' | 'email'>>;
  pendingTransfers?: Array<{
    id: string;
    fromUserId: string;
    toUserId: string;
    quantity: number;
    status: 'PENDING';
    fromUser: Pick<User, 'id' | 'name'>;
    toUser: Pick<User, 'id' | 'name'>;
  }>;
}

export interface ItemResponsibility {
  id: string;
  userId: string;
  committedQuantity: number;
  packedQuantity: number;
  extraQuantity: number;
  status: string;
  user: { id: string; name: string; email: string };
}

export interface ItemCoverage {
  requiredQuantity: number;
  committedQuantity: number;
  packedQuantity: number;
  extraQuantity: number;
  uncoveredQuantity: number;
  status: string;
}

export interface SharedItemWithCoverage {
  id: string;
  name: string;
  category?: string | null;
  isMandatory?: boolean;
  notes?: string | null;
  requiredQuantity: number;
  responsibilities: ItemResponsibility[];
  coverage: ItemCoverage;
}

export interface ClaimResponsibilityDto {
  quantity?: number;
}

export interface PackResponsibilityDto {
  quantity?: number;
}

export interface ExtraResponsibilityDto {
  quantity?: number;
}

export interface ReportMissingDto {
  reason: 'FORGOT' | 'COULD_NOT_BRING' | 'REPLACEMENT_ARRANGED';
}

export interface TransferResponsibilityDto {
  targetUserId: string;
  quantity?: number;
}

export interface TakeOverDto {
  quantity?: number;
}

// ─── Team Inventory & Custody Types ────────────────────────────────────────

export type InventoryTrackingType = 'ASSET' | 'BATCH';
export type AssetCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED' | 'LOST';
export type AssetStatus = 'AVAILABLE' | 'CHECKED_OUT' | 'RESERVED' | 'MAINTENANCE' | 'RETIRED';

export interface StorageLocation {
  id: string;
  groupId: string;
  name: string;
  description?: string | null;
}

export interface InventoryBatch {
  id: string;
  itemId: string;
  batchNumber?: string | null;
  quantity: number;
  availableQuantity: number;
  locationId?: string | null;
  location?: StorageLocation | null;
  expiryDate?: string | null;
  createdAt: string;
}

export interface InventoryAsset {
  id: string;
  itemId: string;
  assetTag?: string | null;
  serialNumber?: string | null;
  condition: AssetCondition;
  status: AssetStatus;
  locationId?: string | null;
  location?: StorageLocation | null;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  groupId: string;
  name: string;
  category?: string | null;
  description?: string | null;
  trackingType: InventoryTrackingType;
  unit?: string | null;
  minimumQuantity?: number;
  isArchived: boolean;
  totalQuantity?: number;
  availableQuantity?: number;
  reservedQuantity?: number;
  checkedOutQuantity?: number;
  batches?: InventoryBatch[];
  assets?: InventoryAsset[];
}

export interface InventoryCustody {
  id: string;
  groupId: string;
  itemId: string;
  userId: string;
  assetId?: string | null;
  batchId?: string | null;
  quantity: number;
  checkedOutAt: string;
  expectedReturnAt?: string | null;
  returnedAt?: string | null;
  user?: User;
  item?: InventoryItem;
  asset?: InventoryAsset | null;
  batch?: InventoryBatch | null;
}

export interface InventoryHistoryEntry {
  id: string;
  groupId: string;
  itemId: string;
  action: string;
  quantity?: number | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
  user?: Pick<User, 'id' | 'name' | 'email'> | null;
  item?: Pick<InventoryItem, 'id' | 'name'> | null;
}

export interface InventoryQrResolution {
  token: string;
  targetType: 'ITEM' | 'ASSET' | 'LOCATION';
  item?: InventoryItem;
  asset?: InventoryAsset;
  location?: StorageLocation;
  activeCustody?: InventoryCustody | null;
}
