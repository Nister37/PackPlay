export interface User {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  sport: string;
  description?: string;
  createdAt: string;
  memberCount?: number;
}

export interface GroupMember {
  id: string;
  userId: string;
  groupId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  user: User;
  joinedAt: string;
}

export interface GroupActivity {
  id: string;
  groupId: string;
  sportProfileId: string;
  name: string;
  scheduledAt?: string;
  description?: string;
}

export interface SharedItem {
  id: string;
  activityId: string;
  name: string;
  description?: string;
  requiredQuantity: number;
  coveredQuantity: number;
  unit?: string;
}

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
  notes?: string | null;
  requiredQuantity: number;
  responsibilities: ItemResponsibility[];
  coverage: ItemCoverage;
}

export interface PackingSession {
  id: string;
  userId: string;
  activityId?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  startedAt: string;
  completedAt?: string;
}

export interface PackingDecision {
  id: string;
  sessionId: string;
  sharedItemId?: string;
  equipmentItemId?: string;
  decision: 'PACKED' | 'NOT_PACKED' | 'SKIPPED';
  reason?: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
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

export interface Invitation {
  id: string;
  groupId: string;
  token: string;
  expiresAt: string;
  maxUses?: number;
  useCount: number;
  group: Group;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}
