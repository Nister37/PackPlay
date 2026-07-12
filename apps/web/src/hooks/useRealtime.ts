import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createSocket } from '@/lib/socket';

interface UseRealtimeOptions {
  activityId?: string;
  groupId?: string;
}

export function useRealtime(options?: UseRealtimeOptions) {
  const queryClient = useQueryClient();
  const socketRef = useRef<ReturnType<typeof createSocket> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = createSocket(token);
    socketRef.current = socket;

    socket.on('connect', () => {
      if (options?.activityId) {
        socket.emit('join:activity', { activityId: options.activityId });
      }
      if (options?.groupId) {
        socket.emit('join:group', { groupId: options.groupId });
      }
    });

    socket.on('coverage:updated', ({ activityId }: { activityId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['shared-items', activityId] });
      queryClient.invalidateQueries({ queryKey: ['coverage'] });
    });

    socket.on('readiness:updated', ({ activityId }: { activityId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['readiness', activityId] });
    });

    socket.on('item:claimed', () => {
      queryClient.invalidateQueries({ queryKey: ['coverage'] });
    });

    socket.on('item:packed', () => {
      queryClient.invalidateQueries({ queryKey: ['coverage'] });
    });

    socket.on('item:released', () => {
      queryClient.invalidateQueries({ queryKey: ['coverage'] });
    });

    socket.on('item:missing', () => {
      queryClient.invalidateQueries({ queryKey: ['coverage'] });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [options?.activityId, options?.groupId]);

  return { socket: socketRef.current };
}
