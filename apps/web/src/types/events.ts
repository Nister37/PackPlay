import type { User } from './auth';

export interface PreparationTemplate {
  id: string;
  groupId: string;
  name: string;
  description?: string | null;
  sportProfileId: string;
  versions?: Array<{
    id: string;
    versionNumber: number;
    createdAt: string;
    itemCount: number;
  }>;
}

export interface EventRole {
  id: string;
  activityId: string;
  name: string;
  description?: string | null;
  requiredCount: number;
  assignments: Array<{
    id: string;
    userId: string;
    user: Pick<User, 'id' | 'name' | 'email'>;
  }>;
}

export interface EventMemberPreference {
  userId: string;
  attending: boolean;
  packingTimeMinutes?: number | null;
  leavingTime?: string | null;
  user?: Pick<User, 'id' | 'name' | 'email'>;
}

export interface EventLogEntry {
  id: string;
  activityId: string;
  action: string;
  details?: Record<string, unknown> | null;
  createdAt: string;
  user?: Pick<User, 'id' | 'name' | 'email'> | null;
}
