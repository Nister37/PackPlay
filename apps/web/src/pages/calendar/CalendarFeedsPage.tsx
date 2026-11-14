import { useState, type ChangeEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, ArrowLeft } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import type { CalendarFeed, CalendarPreviewEvent, GroupMember } from '@/types';

export function CalendarFeedsPage() {
  const { groupId = '' } = useParams<{ groupId: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [feedUrl, setFeedUrl] = useState('');
  const [feedName, setFeedName] = useState('');
  const [previewEvents, setPreviewEvents] = useState<CalendarPreviewEvent[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // File import state
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');

  const { data: members } = useQuery<GroupMember[]>({
    queryKey: ['members', groupId],
    queryFn: () => api.get(`/groups/${groupId}/members`).then((r) => r.data),
    enabled: !!groupId,
  });

  const { data: feeds, isLoading: feedsLoading } = useQuery<CalendarFeed[]>({
    queryKey: ['calendar-feeds', groupId],
    queryFn: () => api.get(`/groups/${groupId}/calendar-feeds`).then((r) => r.data),
    enabled: !!groupId,
  });

  const myRole = members?.find((m) => m.userId === user?.id)?.role;
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  // Preview URL mutation
  const previewUrlMutation = useMutation({
    mutationFn: async () => {
      setPreviewError(null);
      const res = await api.post(`/groups/${groupId}/calendar-feeds/preview-url`, {
        url: feedUrl.trim(),
      });
      return res.data;
    },
    onSuccess: (data) => {
      setPreviewEvents(data.events ?? data ?? []);
    },
    onError: (err: any) => {
      setPreviewError(
        err?.response?.data?.message || 'Failed to preview calendar feed. Verify the HTTPS URL.',
      );
    },
  });

  // Connect Feed mutation
  const connectFeedMutation = useMutation({
    mutationFn: () =>
      api.post(`/groups/${groupId}/calendar-feeds`, {
        name: feedName.trim() || 'Schedule Feed',
        url: feedUrl.trim(),
      }),
    onSuccess: () => {
      setFeedUrl('');
      setFeedName('');
      setPreviewEvents([]);
      queryClient.invalidateQueries({ queryKey: ['calendar-feeds', groupId] });
    },
    onError: (err: any) => {
      setPreviewError(err?.response?.data?.message || 'Failed to connect feed.');
    },
  });

  // Handle ICS file selection
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name.replace(/\.[^/.]+$/, ''));
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
      previewFileMutation.mutate(content);
    };
    reader.readAsText(file);
  };

  const previewFileMutation = useMutation({
    mutationFn: async (content: string) => {
      setPreviewError(null);
      const res = await api.post(`/groups/${groupId}/calendar-feeds/preview-file`, { content });
      return res.data;
    },
    onSuccess: (data) => {
      setPreviewEvents(data.events ?? data ?? []);
    },
    onError: (err: any) => {
      setPreviewError(err?.response?.data?.message || 'Failed to parse iCalendar file.');
    },
  });

  const importFileMutation = useMutation({
    mutationFn: () =>
      api.post(`/groups/${groupId}/calendar-feeds/import-file`, {
        name: fileName.trim() || 'Imported Schedule',
        content: fileContent,
      }),
    onSuccess: () => {
      setFileContent(null);
      setPreviewEvents([]);
      queryClient.invalidateQueries({ queryKey: ['calendar-feeds', groupId] });
      queryClient.invalidateQueries({ queryKey: ['activities', groupId] });
      alert('Events imported successfully into group schedule.');
    },
    onError: (err: any) => {
      setPreviewError(err?.response?.data?.message || 'Failed to import file.');
    },
  });

  // Sync Feed mutation
  const syncFeedMutation = useMutation({
    mutationFn: (feedId: string) =>
      api.post(`/groups/${groupId}/calendar-feeds/${feedId}/sync`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-feeds', groupId] });
      queryClient.invalidateQueries({ queryKey: ['activities', groupId] });
    },
  });

  // Disconnect Feed mutation
  const disconnectFeedMutation = useMutation({
    mutationFn: (feedId: string) =>
      api.delete(`/groups/${groupId}/calendar-feeds/${feedId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-feeds', groupId] });
    },
  });

  return (
    <PageLayout>
      <div className="py-6 space-y-6">
        <header>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to={`/groups/${groupId}`}
              className="font-headline font-bold text-sm uppercase underline text-brand-text"
            >
              <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Squad
            </Link>
            <span className="text-brand-muted">/</span>
            <span className="font-headline text-xs uppercase tracking-widest text-brand-muted">
              SCHEDULE INTEGRATIONS
            </span>
          </div>
          <h1 className="font-headline text-2xl font-bold uppercase tracking-wider text-brand-text">
            Calendar & Schedule Feeds
          </h1>
          <p className="font-body text-xs text-brand-muted">
            Connect live iCalendar, TeamSnap, or GameChanger feeds, or import ICS schedule files.
          </p>
        </header>

        {previewError && (
          <div className="bg-white border border-[#BA1A1A] p-4 rounded-lg">
            <p className="font-body text-sm text-[#BA1A1A]">{previewError}</p>
          </div>
        )}

        {/* Connect URL Section */}
        {canManage && (
          <div className="bg-white border border-brand-border rounded-lg p-5 space-y-4">
            <h2 className="font-headline font-bold text-sm uppercase text-brand-text">
              Subscribe to Live Calendar Feed (URL)
            </h2>
            <div className="space-y-3">
              <Input
                label="Feed Name"
                value={feedName}
                onChange={(e) => setFeedName(e.target.value)}
                placeholder="e.g. TeamSnap League Schedule"
              />
              <Input
                label="HTTPS iCalendar / WebCal URL"
                type="url"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                placeholder="https://teamsnap.com/schedule/calendar.ics"
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={!feedUrl.trim() || previewUrlMutation.isPending}
                  loading={previewUrlMutation.isPending}
                  onClick={() => previewUrlMutation.mutate()}
                >
                  Preview Feed
                </Button>
                <Button
                  variant="urgent"
                  disabled={!feedUrl.trim() || connectFeedMutation.isPending}
                  loading={connectFeedMutation.isPending}
                  onClick={() => connectFeedMutation.mutate()}
                >
                  Connect & Sync
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* File Import Section */}
        {canManage && (
          <div className="bg-white border border-brand-border rounded-lg p-5 space-y-4">
            <h2 className="font-headline font-bold text-sm uppercase text-brand-text">
              Import iCalendar / ICS File
            </h2>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <input
                type="file"
                accept=".ics,text/calendar"
                onChange={handleFileChange}
                className="text-xs file:mr-3 file:py-2 file:px-4 file:border file:border-brand-border file:font-headline file:text-xs file:uppercase file:bg-brand-bg hover:file:bg-brand-bg/80"
              />
              {fileContent && (
                <Button
                  variant="urgent"
                  size="sm"
                  loading={importFileMutation.isPending}
                  onClick={() => importFileMutation.mutate()}
                >
                  Import {previewEvents.length} Events
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Preview Events List */}
        {previewEvents.length > 0 && (
          <div className="bg-white border border-brand-border rounded-lg p-5 space-y-3">
            <h3 className="font-headline font-bold text-xs uppercase tracking-wider text-brand-muted">
              Detected Events Preview ({previewEvents.length})
            </h3>
            <div className="max-h-60 overflow-y-auto divide-y divide-brand-border">
              {previewEvents.slice(0, 15).map((ev, i) => (
                <div key={i} className="py-2 text-xs flex justify-between">
                  <div>
                    <p className="font-headline font-bold uppercase text-brand-text">{ev.title}</p>
                    {ev.location && (
                      <p className="text-brand-muted text-[10px] flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-brand-muted shrink-0" />
                        <span>{ev.location}</span>
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-brand-muted text-[10px]">
                    {ev.startsAt || ev.startDate
                      ? new Date(ev.startsAt || ev.startDate!).toLocaleDateString()
                      : '—'}
                  </span>
                </div>
              ))}
              {previewEvents.length > 15 && (
                <p className="text-center font-headline text-[10px] uppercase text-brand-muted pt-2">
                  + {previewEvents.length - 15} more events
                </p>
              )}
            </div>
          </div>
        )}

        {/* Connected Feeds List */}
        <div className="space-y-3">
          <h2 className="font-headline font-bold text-sm uppercase text-brand-text">
            Active Subscriptions
          </h2>

          {feedsLoading ? (
            <div className="py-6 flex justify-center">
              <LoadingSpinner size="sm" />
            </div>
          ) : feeds && feeds.length > 0 ? (
            <div className="bg-white border border-brand-border rounded-lg divide-y divide-brand-border">
              {feeds.map((feed) => (
                <div key={feed.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-headline font-bold text-sm uppercase text-brand-text">
                      {feed.name}
                    </h3>
                    <p className="font-mono text-xs text-brand-muted mt-0.5">
                      {feed.feedUrlMasked || 'Encrypted feed source'}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-[11px] font-body text-brand-muted">
                      <span>Status: <strong className="text-[#2D6A4F]">{feed.syncStatus || (feed.lastError ? 'FAILED' : 'ACTIVE')}</strong></span>
                      {feed.lastSyncedAt && (
                        <span>Last sync: {new Date(feed.lastSyncedAt).toLocaleString()}</span>
                      )}
                    </div>
                  </div>

                  {canManage && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={syncFeedMutation.isPending}
                        onClick={() => syncFeedMutation.mutate(feed.id)}
                      >
                        Sync Now
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#BA1A1A]"
                        loading={disconnectFeedMutation.isPending}
                        onClick={() => {
                          if (window.confirm('Disconnect this feed? Imported events will be preserved.')) {
                            disconnectFeedMutation.mutate(feed.id);
                          }
                        }}
                      >
                        Disconnect
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-brand-border rounded-lg p-6 text-center">
              <p className="font-headline text-xs uppercase text-brand-muted">
                No external calendar feeds subscribed yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
