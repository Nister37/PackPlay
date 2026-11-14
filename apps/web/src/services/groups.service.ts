import api from '@/lib/api';
import type {
  Group,
  GroupMember,
  GroupActivity,
  CreateGroupDto,
  UpdateGroupDto,
  CreateActivityDto,
  Invitation,
} from '@/types';

/**
 * Domain Service for Groups & Activities.
 * Handles group lifecycles, membership, and activity scheduling endpoints.
 */
export const groupsService = {
  /**
   * Retrieves all groups for the authenticated user.
   */
  async listGroups(): Promise<Group[]> {
    const response = await api.get<Group[]>('/groups');
    return response.data;
  },

  /**
   * Fetches full group details by unique ID.
   */
  async getGroup(id: string): Promise<Group> {
    const response = await api.get<Group>(`/groups/${id}`);
    return response.data;
  },

  /**
   * Creates a new group.
   */
  async createGroup(dto: CreateGroupDto): Promise<Group> {
    const response = await api.post<Group>('/groups', dto);
    return response.data;
  },

  /**
   * Updates existing group settings.
   */
  async updateGroup(id: string, dto: UpdateGroupDto): Promise<Group> {
    const response = await api.patch<Group>(`/groups/${id}`, dto);
    return response.data;
  },

  /**
   * Deletes a group (Owner only).
   */
  async deleteGroup(id: string): Promise<void> {
    await api.delete(`/groups/${id}`);
  },

  /**
   * Retrieves all members associated with a group.
   */
  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const response = await api.get<GroupMember[]>(`/groups/${groupId}/members`);
    return response.data;
  },

  /**
   * Retrieves all scheduled activities for a group.
   */
  async getGroupActivities(groupId: string): Promise<GroupActivity[]> {
    const response = await api.get(`/groups/${groupId}/activities`);
    return Array.isArray(response.data)
      ? response.data
      : response.data?.data ?? [];
  },

  /**
   * Schedules a new activity for a group.
   */
  async createActivity(
    groupId: string,
    dto: CreateActivityDto,
  ): Promise<GroupActivity> {
    const response = await api.post<GroupActivity>(
      `/groups/${groupId}/activities`,
      dto,
    );
    return response.data;
  },

  /**
   * Leaves a group as a non-sole-owner member.
   */
  async leaveGroup(groupId: string): Promise<unknown> {
    const response = await api.post(`/groups/${groupId}/leave`);
    return response.data;
  },

  /**
   * Deletes an activity from a group.
   */
  async deleteActivity(groupId: string, activityId: string): Promise<void> {
    await api.delete(`/groups/${groupId}/activities/${activityId}`);
  },

  /**
   * Removes a member from a group.
   */
  async removeMember(groupId: string, memberId: string): Promise<void> {
    await api.delete(`/groups/${groupId}/members/${memberId}`);
  },

  /**
   * Updates a member's role in a group.
   */
  async updateMemberRole(
    groupId: string,
    memberId: string,
    role: 'ADMIN' | 'MEMBER',
  ): Promise<GroupMember> {
    const response = await api.patch<GroupMember>(
      `/groups/${groupId}/members/${memberId}`,
      { role },
    );
    return response.data;
  },

  /**
   * Fetches active invitations for a group.
   */
  async getInvitations(groupId: string): Promise<Invitation[]> {
    const response = await api.get(`/groups/${groupId}/invitations`);
    return Array.isArray(response.data) ? response.data : response.data?.data ?? [];
  },

  /**
   * Creates an invitation for a group.
   */
  async createInvitation(
    groupId: string,
    dto?: { expiresInHours?: number; maxUses?: number },
  ): Promise<Invitation> {
    const response = await api.post<Invitation>(
      `/groups/${groupId}/invitations`,
      dto ?? {},
    );
    return response.data;
  },

  /**
   * Regenerates an invitation token for a group.
   */
  async regenerateInvitation(
    groupId: string,
    dto?: { expiresInHours?: number; maxUses?: number },
  ): Promise<Invitation> {
    const response = await api.post<Invitation>(
      `/groups/${groupId}/invitations/regenerate`,
      dto ?? {},
    );
    return response.data;
  },
  /**
   * Broadcasts an equipment packing reminder to all group members for an activity.
   */
  async broadcastReminder(groupId: string, activityId: string): Promise<unknown> {
    const response = await api.post(
      `/groups/${groupId}/activities/${activityId}/broadcast-reminder`,
    );
    return response.data;
  },
};

// Named exports for convenient direct imports
export const {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  getGroupActivities,
  createActivity,
  leaveGroup,
  deleteActivity,
  removeMember,
  updateMemberRole,
  getInvitations,
  createInvitation,
  regenerateInvitation,
  broadcastReminder,
} = groupsService;
