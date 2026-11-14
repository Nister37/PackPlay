import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsService } from '@/services/groups.service';
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
 * Hook for retrieving and mutating the list of user groups.
 */
export function useGroups() {
  const query = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => groupsService.listGroups(),
  });

  return {
    groups: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Hook for managing a specific group, its members, activities, and lifecycle.
 * Utilizes groupsService instead of calling raw API endpoints directly.
 */
export function useGroup(groupId?: string | null) {
  const queryClient = useQueryClient();

  const groupQuery = useQuery<Group>({
    queryKey: ['group', groupId],
    queryFn: () => groupsService.getGroup(groupId!),
    enabled: !!groupId,
  });

  const membersQuery = useQuery<GroupMember[]>({
    queryKey: ['members', groupId],
    queryFn: () => groupsService.getGroupMembers(groupId!),
    enabled: !!groupId,
  });

  const activitiesQuery = useQuery<GroupActivity[]>({
    queryKey: ['activities', groupId],
    queryFn: () => groupsService.getGroupActivities(groupId!),
    enabled: !!groupId,
  });

  const invitationsQuery = useQuery<Invitation[]>({
    queryKey: ['invitations', groupId],
    queryFn: () => groupsService.getInvitations(groupId!),
    enabled: !!groupId,
  });

  const invalidate = () => {
    if (groupId) {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['activities', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group-activities', groupId] });
      queryClient.invalidateQueries({ queryKey: ['invitations', groupId] });
    }
    queryClient.invalidateQueries({ queryKey: ['groups'] });
  };

  const createGroupMutation = useMutation({
    mutationFn: (dto: CreateGroupDto) => groupsService.createGroup(dto),
    onSuccess: invalidate,
  });

  const updateGroupMutation = useMutation({
    mutationFn: (params: UpdateGroupDto & { groupId?: string }) => {
      const targetId = params.groupId || groupId;
      if (!targetId) throw new Error('groupId is required to update group');
      return groupsService.updateGroup(targetId, params);
    },
    onSuccess: invalidate,
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (targetGroupId?: string) => {
      const targetId = targetGroupId || groupId;
      if (!targetId) throw new Error('groupId is required to delete group');
      return groupsService.deleteGroup(targetId);
    },
    onSuccess: invalidate,
  });

  const createActivityMutation = useMutation({
    mutationFn: (params: CreateActivityDto & { groupId?: string }) => {
      const targetId = params.groupId || groupId;
      if (!targetId) throw new Error('groupId is required to create activity');
      return groupsService.createActivity(targetId, params);
    },
    onSuccess: invalidate,
  });

  const deleteActivityMutation = useMutation({
    mutationFn: (params: { activityId: string; groupId?: string }) => {
      const targetId = params.groupId || groupId;
      if (!targetId) throw new Error('groupId is required to delete activity');
      return groupsService.deleteActivity(targetId, params.activityId);
    },
    onSuccess: invalidate,
  });

  const removeMemberMutation = useMutation({
    mutationFn: (params: { memberId: string; groupId?: string }) => {
      const targetId = params.groupId || groupId;
      if (!targetId) throw new Error('groupId is required to remove member');
      return groupsService.removeMember(targetId, params.memberId);
    },
    onSuccess: invalidate,
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: (params: { memberId: string; role: 'ADMIN' | 'MEMBER'; groupId?: string }) => {
      const targetId = params.groupId || groupId;
      if (!targetId) throw new Error('groupId is required to update member role');
      return groupsService.updateMemberRole(targetId, params.memberId, params.role);
    },
    onSuccess: invalidate,
  });

  const createInvitationMutation = useMutation({
    mutationFn: (params?: { expiresInHours?: number; maxUses?: number; groupId?: string }) => {
      const targetId = params?.groupId || groupId;
      if (!targetId) throw new Error('groupId is required to create invitation');
      return groupsService.createInvitation(targetId, params);
    },
    onSuccess: invalidate,
  });

  const regenerateInvitationMutation = useMutation({
    mutationFn: (params?: { expiresInHours?: number; maxUses?: number; groupId?: string }) => {
      const targetId = params?.groupId || groupId;
      if (!targetId) throw new Error('groupId is required to regenerate invitation');
      return groupsService.regenerateInvitation(targetId, params);
    },
    onSuccess: invalidate,
  });

  const leaveGroupMutation = useMutation({
    mutationFn: (targetGroupId?: string) => {
      const targetId = targetGroupId || groupId;
      if (!targetId) throw new Error('groupId is required to leave group');
      return groupsService.leaveGroup(targetId);
    },
    onSuccess: invalidate,
  });

  return {
    group: groupQuery.data,
    isLoading: groupQuery.isLoading,
    isError: groupQuery.isError,
    error: groupQuery.error,
    refetchGroup: groupQuery.refetch,

    members: membersQuery.data ?? [],
    isMembersLoading: membersQuery.isLoading,
    refetchMembers: membersQuery.refetch,

    activities: activitiesQuery.data ?? [],
    isActivitiesLoading: activitiesQuery.isLoading,
    refetchActivities: activitiesQuery.refetch,

    invitations: invitationsQuery.data ?? [],
    isInvitationsLoading: invitationsQuery.isLoading,
    refetchInvitations: invitationsQuery.refetch,

    createGroup: createGroupMutation.mutateAsync,
    updateGroup: updateGroupMutation.mutateAsync,
    deleteGroup: deleteGroupMutation.mutateAsync,
    createActivity: createActivityMutation.mutateAsync,
    deleteActivity: deleteActivityMutation.mutateAsync,
    removeMember: removeMemberMutation.mutateAsync,
    updateMemberRole: updateMemberRoleMutation.mutateAsync,
    createInvitation: createInvitationMutation.mutateAsync,
    regenerateInvitation: regenerateInvitationMutation.mutateAsync,
    leaveGroup: leaveGroupMutation.mutateAsync,

    createGroupMutation,
    updateGroupMutation,
    deleteGroupMutation,
    createActivityMutation,
    deleteActivityMutation,
    removeMemberMutation,
    updateMemberRoleMutation,
    createInvitationMutation,
    regenerateInvitationMutation,
    leaveGroupMutation,
  };
}
