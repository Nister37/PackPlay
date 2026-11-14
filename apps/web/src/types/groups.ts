import type { User } from './auth';

export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type ActivityType = 'TRAINING' | 'COMPETITION' | 'CASUAL' | 'TRAVEL';

export interface Group {
  id: string;
  name: string;
  sport?: string;
  sportType?: string;
  description?: string;
  maxMembers?: number | null;
  createdAt: string;
  memberCount?: number;
}

export interface GroupMember {
  id: string;
  userId: string;
  groupId: string;
  role: GroupRole;
  user: User;
  joinedAt: string;
}

export interface GroupActivity {
  id: string;
  groupId: string;
  sportProfileId?: string;
  name: string;
  activityType?: ActivityType;
  scheduledAt?: string;
  date?: string;
  endAt?: string;
  description?: string;
  venueName?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  environment?: 'OUTDOOR' | 'COVERED_OUTDOOR' | 'INDOOR' | null;
  surface?: string | null;
  group?: Group;
  sportProfile?: { id: string; name: string };
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

export interface CreateGroupDto {
  name: string;
  sport?: string;
  description?: string;
  maxMembers?: number | null;
}

export interface UpdateGroupDto {
  name?: string;
  sport?: string;
  description?: string;
  maxMembers?: number | null;
}

export interface CreateActivityDto {
  name: string;
  sportProfileId?: string;
  activityType?: ActivityType;
  date?: string;
  scheduledAt?: string;
  endAt?: string;
  description?: string;
  venueName?: string;
  environment?: 'OUTDOOR' | 'COVERED_OUTDOOR' | 'INDOOR';
  surface?: string;
}
