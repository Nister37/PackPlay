import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Calendar,
  Luggage,
  CloudRain,
  Wind,
  RefreshCw,
  Trash2,
  MapPin,
  ArrowLeft,
} from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { GemmaAssistantModal } from '@/components/ai/GemmaAssistantModal';
import { useAuth } from '@/hooks/useAuth';
import type { ParsedSmartItem } from '@/lib/smartEntry';
import api from '@/lib/api';
import type {
  GroupActivity,
  GroupMember,
  GroupReadiness,
  SharedItemWithCoverage,
  ActivityWeatherSnapshot,
  EventRole,
  EventLogEntry,
} from '@/types';

export function EventDetailPage() {
  const { groupId = '', activityId = '' } = useParams<{ groupId: string; activityId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'manifest' | 'weather' | 'roles' | 'log'>('manifest');

  // Smart Add Modal state
  const [showSmartAdd, setShowSmartAdd] = useState(false);

  // Add Item state
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [itemCategory, setItemCategory] = useState('EQUIPMENT');
  const [catalogueSuggestions, setCatalogueSuggestions] = useState<Array<{ name: string; category?: string }>>([]);

  // Location & Weather state
  const [venueInput, setVenueInput] = useState('');
  const [latInput, setLatInput] = useState<number | string>('');
  const [lonInput, setLonInput] = useState<number | string>('');
  const [environmentInput, setEnvironmentInput] = useState<'OUTDOOR' | 'COVERED_OUTDOOR' | 'INDOOR'>('OUTDOOR');

  // Recurrence Modal state
  const [showRecurrenceModal, setShowRecurrenceModal] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'>('WEEKLY');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceOccurrences, setRecurrenceOccurrences] = useState(6);

  // Template Modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');

  // Role Modal state
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [roleRequiredCount, setRoleRequiredCount] = useState(1);

  // Attendance state
  const [attendingStatus, setAttendingStatus] = useState<boolean>(true);
  const [packingMinutes, setPackingMinutes] = useState<number>(30);

  // Broadcast feedback state
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  // Queries
  const { data: activity, isLoading: activityLoading } = useQuery<GroupActivity & { recurrenceSeriesId?: string }>({
    queryKey: ['activity', activityId],
    queryFn: () => api.get(`/groups/${groupId}/activities/${activityId}`).then((r) => r.data),
    enabled: !!groupId && !!activityId,
  });

  // Sync location form fields when activity data loads
  useEffect(() => {
    if (activity) {
      setVenueInput(activity.venueName || '');
      setLatInput(activity.latitude != null ? String(activity.latitude) : '');
      setLonInput(activity.longitude != null ? String(activity.longitude) : '');
      setEnvironmentInput((activity.environment as any) || 'OUTDOOR');
    }
  }, [activity]);

  const { data: members } = useQuery<GroupMember[]>({
    queryKey: ['members', groupId],
    queryFn: () => api.get(`/groups/${groupId}/members`).then((r) => r.data),
    enabled: !!groupId,
  });

  const { data: sharedItems, isLoading: itemsLoading } = useQuery<SharedItemWithCoverage[]>({
    queryKey: ['shared-items', activityId],
    queryFn: () => api.get(`/activities/${activityId}/shared-items`).then((r) => r.data),
    enabled: !!activityId,
  });

  const { data: readiness } = useQuery<GroupReadiness>({
    queryKey: ['readiness', activityId],
    queryFn: () => api.get(`/activities/${activityId}/readiness`).then((r) => r.data),
    enabled: !!activityId,
  });

  const { data: weatherSnapshot } = useQuery<ActivityWeatherSnapshot>({
    queryKey: ['weather', activityId],
    queryFn: () => api.get(`/groups/${groupId}/activities/${activityId}/weather`).then((r) => r.data),
    enabled: !!groupId && !!activityId,
  });

  const { data: roles } = useQuery<EventRole[]>({
    queryKey: ['event-roles', activityId],
    queryFn: () => api.get(`/groups/${groupId}/activities/${activityId}/roles`).then((r) => r.data),
    enabled: !!groupId && !!activityId && activeTab === 'roles',
  });

  const { data: activityLogEntries } = useQuery<{ data: EventLogEntry[] }>({
    queryKey: ['activity-log', activityId],
    queryFn: () => api.get(`/groups/${groupId}/activities/${activityId}/activity-log`).then((r) => r.data),
    enabled: !!groupId && !!activityId && activeTab === 'log',
  });

  const myRole = members?.find((m) => m.userId === user?.id)?.role;
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  // Autocomplete query for item search
  useEffect(() => {
    if (!itemName || itemName.length < 2) {
      setCatalogueSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/equipment-catalogue/search', {
          params: { query: itemName },
        });
        const items = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
        setCatalogueSuggestions(
          items.map((it: any) => ({
            name: it.canonicalName || it.name,
            category: it.category,
          })),
        );
      } catch {
        // Ignore search errors
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [itemName]);

  // Mutations
  const addItemMutation = useMutation({
    mutationFn: () =>
      api.post(`/activities/${activityId}/shared-items`, {
        name: itemName.trim(),
        requiredQuantity: Number(itemQty) || 1,
        category: itemCategory || undefined,
      }),
    onSuccess: () => {
      setShowAddItem(false);
      setItemName('');
      setItemQty(1);
      queryClient.invalidateQueries({ queryKey: ['shared-items', activityId] });
      queryClient.invalidateQueries({ queryKey: ['readiness', activityId] });
    },
  });

  const acceptSmartDraftsMutation = useMutation({
    mutationFn: (itemsToAccept: ParsedSmartItem[]) =>
      api.post(`/activities/${activityId}/smart-drafts/accept`, {
        acceptedItems: itemsToAccept.map((item) => ({
          target: 'SHARED',
          name: item.name,
          quantity: item.quantity,
          category: item.category,
          isMandatory: item.isMandatory ?? true,
          reason: item.reason,
        })),
      }),
    onSuccess: () => {
      setShowSmartAdd(false);
      queryClient.invalidateQueries({ queryKey: ['shared-items', activityId] });
      queryClient.invalidateQueries({ queryKey: ['readiness', activityId] });
    },
  });

  const refreshWeatherMutation = useMutation({
    mutationFn: () => api.post(`/groups/${groupId}/activities/${activityId}/weather/refresh`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weather', activityId] }),
  });

  const acceptWeatherSuggestionMutation = useMutation({
    mutationFn: (suggestionId: string) =>
      api.post(`/groups/${groupId}/activities/${activityId}/weather-suggestions/${suggestionId}/accept`, {
        target: 'SHARED',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weather', activityId] });
      queryClient.invalidateQueries({ queryKey: ['shared-items', activityId] });
      queryClient.invalidateQueries({ queryKey: ['readiness', activityId] });
    },
  });

  const dismissWeatherSuggestionMutation = useMutation({
    mutationFn: (suggestionId: string) =>
      api.post(`/groups/${groupId}/activities/${activityId}/weather-suggestions/${suggestionId}/dismiss`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['weather', activityId] }),
  });

  const duplicateEventMutation = useMutation({
    mutationFn: () => api.post(`/groups/${groupId}/activities/${activityId}/duplicate`),
    onSuccess: (res) => {
      navigate(`/groups/${groupId}/activities/${res.data.id}`);
    },
  });

  const createRecurrenceMutation = useMutation({
    mutationFn: () =>
      api.post(`/groups/${groupId}/activities/${activityId}/recurrence`, {
        frequency: recurrenceFreq,
        interval: Number(recurrenceInterval) || 1,
        count: Number(recurrenceOccurrences) || 6,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      }),
    onSuccess: () => {
      setShowRecurrenceModal(false);
      queryClient.invalidateQueries({ queryKey: ['activity', activityId] });
      queryClient.invalidateQueries({ queryKey: ['activities', groupId] });
    },
  });

  const cancelOccurrenceMutation = useMutation({
    mutationFn: () => api.post(`/groups/${groupId}/activities/${activityId}/cancel-occurrence`),
    onSuccess: () => {
      alert('This recurring occurrence has been cancelled.');
      navigate(`/groups/${groupId}`);
    },
  });

  const saveAsTemplateMutation = useMutation({
    mutationFn: () =>
      api.post(`/groups/${groupId}/preparation-templates/from-events/${activityId}`, {
        name: templateName.trim(),
        description: templateDesc.trim() || undefined,
      }),
    onSuccess: () => {
      setShowTemplateModal(false);
      setTemplateName('');
      alert('Preparation template created from this event.');
    },
  });

  const updateAttendanceMutation = useMutation({
    mutationFn: () => {
      const packingAt =
        activity?.date && packingMinutes
          ? new Date(new Date(activity.date).getTime() - packingMinutes * 60 * 1000).toISOString()
          : undefined;
      return api.patch(`/groups/${groupId}/activities/${activityId}/members/me`, {
        attendanceStatus: attendingStatus ? 'ATTENDING' : 'NOT_ATTENDING',
        ...(packingAt ? { packingAt } : {}),
      });
    },
    onSuccess: () => {
      alert('Your attendance and preparation preferences have been updated.');
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: () =>
      api.post(`/groups/${groupId}/activities/${activityId}/roles`, {
        name: roleName.trim(),
      }),
    onSuccess: () => {
      setShowCreateRole(false);
      setRoleName('');
      setRoleDesc('');
      queryClient.invalidateQueries({ queryKey: ['event-roles', activityId] });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: () => api.delete(`/groups/${groupId}/activities/${activityId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', groupId] });
      navigate(`/groups/${groupId}`);
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => api.delete(`/activities/${activityId}/shared-items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-items', activityId] });
      queryClient.invalidateQueries({ queryKey: ['readiness', activityId] });
    },
  });

  const broadcastReminderMutation = useMutation({
    mutationFn: () => api.post(`/groups/${groupId}/activities/${activityId}/broadcast-reminder`),
    onSuccess: (res) => {
      setBroadcastStatus(`Reminder sent to ${res.data?.notifiedCount ?? 'squad'} member(s)!`);
      setTimeout(() => setBroadcastStatus(null), 4000);
    },
    onError: () => {
      setBroadcastStatus('Failed to send gear reminder broadcast.');
      setTimeout(() => setBroadcastStatus(null), 4000);
    },
  });

  const updateLocationMutation = useMutation({
    mutationFn: (data: {
      venueName?: string;
      latitude?: number;
      longitude?: number;
      environment?: string;
    }) => api.patch(`/groups/${groupId}/activities/${activityId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity', activityId] });
      refreshWeatherMutation.mutate();
      alert('Event location updated and weather forecast refreshed.');
    },
  });

  if (activityLoading) {
    return (
      <PageLayout>
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </PageLayout>
    );
  }

  if (!activity) {
    return (
      <PageLayout>
        <div className="py-12 text-center">
          <p className="font-headline font-bold text-base text-[#BA1A1A] uppercase">
            Activity not found.
          </p>
          <Button variant="ghost" onClick={() => navigate(`/groups/${groupId}`)}>
            Back to Group
          </Button>
        </div>
      </PageLayout>
    );
  }

  const overallReadiness = readiness?.groupPercentage ?? 0;
  const weather = weatherSnapshot?.weather;
  const suggestions = weatherSnapshot?.suggestions ?? [];

  return (
    <PageLayout>
      <div className="py-6 space-y-6">
        {/* Navigation & Actions */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                to={`/groups/${groupId}`}
                className="font-headline font-bold text-sm uppercase underline text-brand-text flex items-center gap-1.5 hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Squad</span>
              </Link>
              <span className="text-brand-muted">/</span>
              <span className="font-headline text-xs uppercase tracking-widest text-brand-muted">
                EVENT SPECIFICATION
              </span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="font-headline text-2xl font-bold uppercase tracking-wider text-brand-text">
                {activity.name}
              </h1>
              {activity.recurrenceSeriesId && (
                <span className="bg-[#1A1A1A] text-white text-[9px] font-headline uppercase px-2 py-0.5 rounded">
                  RECURRING SERIES
                </span>
              )}
            </div>
            {activity.scheduledAt && (
              <p className="font-body text-xs text-brand-muted mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-muted" />
                <span>{new Date(activity.scheduledAt).toLocaleString()}</span>
              </p>
            )}
            {activity.venueName && (
              <p className="font-body text-xs text-brand-muted mt-0.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span>
                  {activity.venueName}
                  {activity.latitude != null && activity.longitude != null && (
                    <span className="text-brand-muted font-mono text-[10px] ml-1">
                      ({activity.latitude}, {activity.longitude})
                    </span>
                  )}
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Link
              to={`/groups/${groupId}/packing?activityId=${activityId}`}
              className="px-4 py-2 bg-primary text-white font-headline font-bold text-xs uppercase tracking-wider hover:bg-primary/90 flex items-center gap-1.5"
            >
              <Luggage className="w-3.5 h-3.5" />
              <span>Start Packing</span>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              loading={broadcastReminderMutation.isPending}
              onClick={() => broadcastReminderMutation.mutate()}
            >
              Broadcast Reminder
            </Button>

            {canManage && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={duplicateEventMutation.isPending}
                  onClick={() => duplicateEventMutation.mutate()}
                >
                  Duplicate
                </Button>

                {!activity.recurrenceSeriesId ? (
                  <Button variant="ghost" size="sm" onClick={() => setShowRecurrenceModal(true)}>
                    Make Recurring
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#BA1A1A]"
                    onClick={() => {
                      if (window.confirm('Cancel this occurrence?')) cancelOccurrenceMutation.mutate();
                    }}
                  >
                    Cancel Occurrence
                  </Button>
                )}

                <Button variant="ghost" size="sm" onClick={() => setShowTemplateModal(true)}>
                  Save as Template
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#BA1A1A] hover:bg-red-50"
                  loading={deleteEventMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete "${activity.name}"? This action cannot be undone.`)) {
                      deleteEventMutation.mutate();
                    }
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete Event
                </Button>
              </>
            )}
          </div>
        </header>

        {broadcastStatus && (
          <div className="p-3 bg-primary/10 border border-primary text-primary text-xs font-headline uppercase font-bold rounded flex items-center justify-between">
            <span>{broadcastStatus}</span>
            <button onClick={() => setBroadcastStatus(null)} className="text-primary hover:text-black">✕</button>
          </div>
        )}

        {/* Readiness Meter & Quick Weather Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Readiness Card */}
          <div className="bg-white border border-brand-border rounded-lg p-5 md:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-headline text-xs font-bold uppercase tracking-wider text-brand-muted">
                Team Gear Readiness
              </span>
              <span className="font-headline text-lg font-bold text-brand-text">
                {Math.round(overallReadiness)}%
              </span>
            </div>
            <ProgressBar value={overallReadiness} />
            <div className="flex justify-between text-xs font-body text-brand-muted">
              <span>
                {readiness?.coveredSharedItems ?? 0} of {readiness?.totalSharedItems ?? 0} items
                committed
              </span>
              <span>
                {readiness?.memberReadiness?.length ?? 0} squad members active
              </span>
            </div>
          </div>

          {/* Quick Weather Status Card */}
          <div className="bg-white border border-brand-border rounded-lg p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-headline text-[10px] font-bold uppercase tracking-wider text-brand-muted block">
                  Event Weather
                </span>
                <p className="font-headline text-base font-bold text-brand-text mt-0.5">
                  {weather ? `${Math.round(weather.temperatureC)}°C · ${weather.description}` : 'Forecast pending'}
                </p>
              </div>
              <button
                onClick={() => setActiveTab('weather')}
                className="text-xs font-headline uppercase underline text-primary"
              >
                View
              </button>
            </div>
            {weather ? (
              <div className="text-[11px] font-body text-brand-muted mt-2 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <CloudRain className="w-3.5 h-3.5 text-primary" />
                  {weather.precipitationProbability}% precip
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5 text-brand-muted" />
                  {Math.round(weather.windSpeedKmh)} km/h wind
                </span>
              </div>
            ) : (
              <p className="text-[11px] font-body text-brand-muted mt-2">
                Coordinates or scheduled date needed.
              </p>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-brand-border">
          <button
            onClick={() => setActiveTab('manifest')}
            className={`px-4 py-2 font-headline text-xs uppercase tracking-wider font-bold border-b-2 transition-colors ${
              activeTab === 'manifest'
                ? 'border-primary text-primary'
                : 'border-transparent text-brand-muted hover:text-brand-text'
            }`}
          >
            Item Manifest ({sharedItems?.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('weather')}
            className={`px-4 py-2 font-headline text-xs uppercase tracking-wider font-bold border-b-2 transition-colors ${
              activeTab === 'weather'
                ? 'border-primary text-primary'
                : 'border-transparent text-brand-muted hover:text-brand-text'
            }`}
          >
            Weather & Suggestions {suggestions.length > 0 && `(${suggestions.length})`}
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-2 font-headline text-xs uppercase tracking-wider font-bold border-b-2 transition-colors ${
              activeTab === 'roles'
                ? 'border-primary text-primary'
                : 'border-transparent text-brand-muted hover:text-brand-text'
            }`}
          >
            Roles & RSVP
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`px-4 py-2 font-headline text-xs uppercase tracking-wider font-bold border-b-2 transition-colors ${
              activeTab === 'log'
                ? 'border-primary text-primary'
                : 'border-transparent text-brand-muted hover:text-brand-text'
            }`}
          >
            Audit Log
          </button>
        </div>

        {/* TAB 1: ITEM MANIFEST WITH SMART ADD */}
        {activeTab === 'manifest' && (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div>
                <h2 className="font-headline font-bold text-sm uppercase text-brand-text">
                  Required Shared Equipment
                </h2>
                <p className="font-body text-xs text-brand-muted">
                  Assign items to members or use Smart Add to parse bulk lists.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSmartAdd(true)}
                  className="border border-[#1A1A1A] flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Smart Add (Natural Language)</span>
                </Button>
                {canManage && (
                  <Button variant="urgent" size="sm" onClick={() => setShowAddItem(true)}>
                    + Add Item
                  </Button>
                )}
              </div>
            </div>

            {itemsLoading ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : sharedItems && sharedItems.length > 0 ? (
              <div className="border border-brand-border bg-white rounded-lg overflow-hidden divide-y divide-brand-border">
                {sharedItems.map((item) => {
                  const covered = item.coverage.committedQuantity;
                  const total = item.requiredQuantity;
                  const uncovered = item.coverage.uncoveredQuantity;
                  const isCovered = uncovered <= 0;

                  return (
                    <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-headline font-bold text-sm uppercase text-brand-text truncate">
                            {item.name}
                          </h3>
                          {isCovered ? (
                            <span className="font-headline text-[9px] uppercase px-1.5 py-0.5 bg-[#2D6A4F] text-white font-bold">
                              COVERED
                            </span>
                          ) : (
                            <span className="font-headline text-[9px] uppercase px-1.5 py-0.5 bg-primary text-white font-bold">
                              NEEDED ({uncovered})
                            </span>
                          )}
                        </div>
                        <div className="w-full max-w-xs h-1.5 bg-[#F0E8E4] rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${total > 0 ? Math.min((covered / total) * 100, 100) : 0}%`,
                              backgroundColor: isCovered ? '#2D6A4F' : '#FF4D00',
                            }}
                          />
                        </div>
                      </div>

                      {/* Responsibilities list */}
                      <div className="flex items-center gap-2">
                        <span className="font-headline font-bold text-sm text-brand-text mr-2">
                          {covered}/{total}
                        </span>
                        <Link
                          to={`/groups/${groupId}/equipment/${item.id}`}
                          className="px-3 py-1.5 border border-brand-border font-headline text-xs uppercase tracking-wider hover:bg-brand-bg transition-colors"
                        >
                          Manage / Claim
                        </Link>
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Remove "${item.name}" from manifest?`)) {
                                deleteItemMutation.mutate(item.id);
                              }
                            }}
                            disabled={deleteItemMutation.isPending}
                            className="p-1.5 border border-red-300 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete item from manifest"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white border border-brand-border rounded-lg p-8 text-center">
                <p className="font-headline text-sm uppercase text-brand-muted">
                  No equipment items added yet.
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <Button variant="ghost" onClick={() => setShowSmartAdd(true)}>
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-primary" /> Smart Add with AI
                    </span>
                  </Button>
                  {canManage && (
                    <Button variant="urgent" onClick={() => setShowAddItem(true)}>
                      + Add Item Manually
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: WEATHER & SUGGESTIONS */}
        {activeTab === 'weather' && (
          <div className="space-y-5">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-headline font-bold text-sm uppercase text-brand-text">
                  Forecast Evaluation & Weather Suggestions
                </h2>
                <p className="font-body text-xs text-brand-muted">
                  Forecast context is retrieved via Open-Meteo for the activity location.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                loading={refreshWeatherMutation.isPending}
                onClick={() => refreshWeatherMutation.mutate()}
              >
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Forecast
                </span>
              </Button>
            </div>

            {/* Detailed Weather Card */}
            {weather ? (
              <div className="bg-white border border-brand-border rounded-lg p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="p-3 bg-brand-bg/40 rounded">
                    <span className="font-headline text-[10px] uppercase text-brand-muted block">
                      Temperature
                    </span>
                    <span className="font-headline font-bold text-2xl text-brand-text">
                      {Math.round(weather.temperatureC)}°C
                    </span>
                  </div>
                  <div className="p-3 bg-brand-bg/40 rounded">
                    <span className="font-headline text-[10px] uppercase text-brand-muted block">
                      Precipitation
                    </span>
                    <span className="font-headline font-bold text-2xl text-primary">
                      {weather.precipitationProbability}%
                    </span>
                  </div>
                  <div className="p-3 bg-brand-bg/40 rounded">
                    <span className="font-headline text-[10px] uppercase text-brand-muted block">
                      Wind Speed
                    </span>
                    <span className="font-headline font-bold text-2xl text-brand-text">
                      {Math.round(weather.windSpeedKmh)} km/h
                    </span>
                  </div>
                  <div className="p-3 bg-brand-bg/40 rounded">
                    <span className="font-headline text-[10px] uppercase text-brand-muted block">
                      Conditions
                    </span>
                    <span className="font-headline font-bold text-sm text-brand-text mt-1 block">
                      {weather.description}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-brand-border rounded-lg p-6 text-center">
                <p className="font-headline text-xs uppercase text-brand-muted">
                  Weather forecast is unavailable for this activity. Ensure location and date are configured.
                </p>
              </div>
            )}

            {/* Location & Coordinates Input Form */}
            <div className="bg-white border border-brand-border rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h3 className="font-headline font-bold text-sm uppercase text-brand-text">
                    Event Location & Weather Check Settings
                  </h3>
                </div>
                {activity.venueName && (
                  <span className="font-headline text-[10px] uppercase text-brand-muted px-2 py-0.5 bg-brand-bg border border-brand-border rounded">
                    Configured: {activity.venueName}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-headline font-bold uppercase text-brand-muted mb-1">
                    City / Venue Name
                  </label>
                  <input
                    type="text"
                    value={venueInput}
                    onChange={(e) => setVenueInput(e.target.value)}
                    placeholder="e.g. London, Wembley Stadium"
                    className="w-full border border-brand-border p-2 bg-white text-xs font-body rounded"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-headline font-bold uppercase text-brand-muted mb-1">
                    Environment
                  </label>
                  <select
                    value={environmentInput}
                    onChange={(e) => setEnvironmentInput(e.target.value as any)}
                    className="w-full border border-brand-border p-2 bg-white text-xs rounded"
                  >
                    <option value="OUTDOOR">Outdoor (Full weather exposure)</option>
                    <option value="COVERED_OUTDOOR">Covered Outdoor</option>
                    <option value="INDOOR">Indoor</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-headline font-bold uppercase text-brand-muted mb-1">
                    Latitude (-90 to 90)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={latInput}
                    onChange={(e) => setLatInput(e.target.value)}
                    placeholder="e.g. 52.2297"
                    className="w-full border border-brand-border p-2 bg-white text-xs font-mono rounded"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-headline font-bold uppercase text-brand-muted mb-1">
                    Longitude (-180 to 180)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={lonInput}
                    onChange={(e) => setLonInput(e.target.value)}
                    placeholder="e.g. 21.0122"
                    className="w-full border border-brand-border p-2 bg-white text-xs font-mono rounded"
                  />
                </div>
              </div>

              {/* Quick City Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] font-headline uppercase text-brand-muted mr-1">Quick Presets:</span>
                {[
                  { name: 'London', lat: 51.5074, lon: -0.1278 },
                  { name: 'Warsaw', lat: 52.2297, lon: 21.0122 },
                  { name: 'Brussels', lat: 50.8503, lon: 4.3517 },
                  { name: 'Berlin', lat: 52.5200, lon: 13.4050 },
                  { name: 'Paris', lat: 48.8566, lon: 2.3522 },
                  { name: 'New York', lat: 40.7128, lon: -74.0060 },
                ].map((city) => (
                  <button
                    key={city.name}
                    type="button"
                    onClick={() => {
                      setVenueInput(city.name);
                      setLatInput(city.lat);
                      setLonInput(city.lon);
                    }}
                    className="text-[10px] font-headline uppercase px-2 py-0.5 border border-brand-border bg-brand-bg hover:bg-primary/10 hover:border-primary transition-colors rounded"
                  >
                    {city.name}
                  </button>
                ))}
                {typeof navigator !== 'undefined' && navigator.geolocation && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setLatInput(parseFloat(pos.coords.latitude.toFixed(4)));
                          setLonInput(parseFloat(pos.coords.longitude.toFixed(4)));
                          if (!venueInput) setVenueInput('Current Location');
                        },
                        () => alert('Unable to retrieve your location from browser.'),
                      );
                    }}
                    className="text-[10px] font-headline uppercase px-2 py-0.5 border border-primary text-primary hover:bg-primary hover:text-white transition-colors rounded ml-auto"
                  >
                    Use My GPS
                  </button>
                )}
              </div>

              {canManage && (
                <div className="flex justify-end pt-2">
                  <Button
                    variant="urgent"
                    size="sm"
                    loading={updateLocationMutation.isPending}
                    onClick={() => {
                      const lat = latInput !== '' ? Number(latInput) : undefined;
                      const lon = lonInput !== '' ? Number(lonInput) : undefined;
                      updateLocationMutation.mutate({
                        venueName: venueInput.trim() || undefined,
                        latitude: lat,
                        longitude: lon,
                        environment: environmentInput,
                      });
                    }}
                  >
                    Save Location & Update Forecast
                  </Button>
                </div>
              )}
            </div>

            {/* Weather Suggestions Section */}
            <div>
              <h3 className="font-headline font-bold text-xs uppercase tracking-wider text-brand-muted mb-3">
                Intelligent Weather Adaptations
              </h3>

              {suggestions.length > 0 ? (
                <div className="space-y-3">
                  {suggestions.map((sug) => (
                    <div
                      key={sug.id}
                      className="bg-white border border-brand-border p-4 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <CloudRain className="w-4 h-4 text-blue-500 shrink-0" />
                          <h4 className="font-headline font-bold text-sm uppercase text-brand-text">
                            {sug.equipmentName} ×{sug.quantity}
                          </h4>
                          {sug.category && (
                            <span className="text-[9px] font-headline uppercase px-1.5 py-0.5 bg-[#1A1A1A] text-white rounded">
                              {sug.category}
                            </span>
                          )}
                        </div>
                        <p className="font-body text-xs text-brand-muted mt-1">{sug.reason}</p>
                      </div>

                      {canManage && (
                        <div className="flex gap-2 shrink-0">
                          <Button
                            variant="urgent"
                            size="sm"
                            loading={acceptWeatherSuggestionMutation.isPending}
                            onClick={() => acceptWeatherSuggestionMutation.mutate(sug.id)}
                          >
                            Accept to Manifest
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => dismissWeatherSuggestionMutation.mutate(sug.id)}
                          >
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-brand-border rounded-lg p-6 text-center">
                  <p className="font-headline text-xs uppercase text-brand-muted">
                    No active weather adjustments required. All conditions are optimal.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: ROLES & RSVP */}
        {activeTab === 'roles' && (
          <div className="space-y-6">
            {/* Member RSVP Form */}
            <div className="bg-white border border-brand-border rounded-lg p-5 space-y-4">
              <h3 className="font-headline font-bold text-sm uppercase text-brand-text">
                Your Event RSVP & Departure
              </h3>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-headline uppercase cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attendingStatus}
                    onChange={(e) => setAttendingStatus(e.target.checked)}
                    className="w-4 h-4 text-primary rounded"
                  />
                  I am attending this event
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-headline uppercase text-brand-muted">
                    Preparation time:
                  </span>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    value={packingMinutes}
                    onChange={(e) => setPackingMinutes(Number(e.target.value))}
                    className="w-20 border border-brand-border p-1 text-xs text-center"
                  />
                  <span className="text-xs font-headline uppercase text-brand-muted">min</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={updateAttendanceMutation.isPending}
                  onClick={() => updateAttendanceMutation.mutate()}
                >
                  Save RSVP
                </Button>
              </div>
            </div>

            {/* Event Roles Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-headline font-bold text-sm uppercase text-brand-text">
                  Event-Specific Roles & Requirements
                </h3>
                {canManage && (
                  <Button variant="ghost" size="sm" onClick={() => setShowCreateRole(true)}>
                    + Create Role
                  </Button>
                )}
              </div>

              {roles && roles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {roles.map((role) => (
                    <div key={role.id} className="bg-white border border-brand-border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-headline font-bold text-sm uppercase text-brand-text">
                          {role.name}
                        </h4>
                        <span className="text-[10px] font-headline uppercase text-brand-muted">
                          {role.assignments?.length ?? 0}/{role.requiredCount} assigned
                        </span>
                      </div>
                      {role.description && (
                        <p className="font-body text-xs text-brand-muted mb-2">
                          {role.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {role.assignments?.map((a) => (
                          <span
                            key={a.id}
                            className="bg-brand-bg border border-brand-border px-2 py-0.5 text-xs font-headline rounded"
                          >
                            {a.user?.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-brand-border rounded-lg p-6 text-center">
                  <p className="font-headline text-xs uppercase text-brand-muted">
                    No custom roles defined for this event.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: AUDIT LOG */}
        {activeTab === 'log' && (
          <div className="space-y-4">
            <h2 className="font-headline font-bold text-sm uppercase text-brand-text">
              Append-Only Activity Audit Log
            </h2>

            {activityLogEntries?.data && activityLogEntries.data.length > 0 ? (
              <div className="bg-white border border-brand-border rounded-lg divide-y divide-brand-border">
                {activityLogEntries.data.map((log) => (
                  <div key={log.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-headline font-bold uppercase text-[10px] px-1.5 py-0.5 bg-[#1A1A1A] text-white rounded mr-2">
                        {log.action}
                      </span>
                      <span className="font-body text-brand-muted">
                        by {log.user?.name || (log as any).actor?.name || 'System'}
                      </span>
                    </div>
                    <span className="text-brand-muted text-[10px]">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-brand-border rounded-lg p-6 text-center">
                <p className="font-headline text-xs uppercase text-brand-muted">
                  No activity log entries found.
                </p>
              </div>
            )}
          </div>
        )}

        {/* MODAL: GEMMA AI ASSISTANT */}
        <GemmaAssistantModal
          isOpen={showSmartAdd}
          onClose={() => setShowSmartAdd(false)}
          onAcceptItems={(items) => acceptSmartDraftsMutation.mutate(items)}
          isSubmitting={acceptSmartDraftsMutation.isPending}
          eventContext={{
            sport: (activity as any)?.group?.sport || (activity as any)?.sport,
            title: activity.name,
            location: (activity as any)?.location,
            weatherDescription: weather?.description,
            temperatureC: weather?.temperatureC,
            memberCount: members?.length,
          }}
        />

        {/* MODAL: ADD ITEM MANUALLY WITH AUTOCOMPLETE */}
        {showAddItem && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-brand-border rounded-lg p-6 max-w-sm w-full space-y-4">
              <h2 className="font-headline font-bold text-base uppercase">Add Manifest Item</h2>
              <div className="relative">
                <Input
                  label="Item Name"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Shin guards"
                />
                {catalogueSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-brand-border mt-1 rounded shadow-lg z-10 max-h-40 overflow-y-auto">
                    {catalogueSuggestions.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setItemName(sug.name);
                          if (sug.category) setItemCategory(sug.category);
                          setCatalogueSuggestions([]);
                        }}
                        className="w-full text-left p-2 hover:bg-brand-bg text-xs flex justify-between"
                      >
                        <span className="font-headline uppercase">{sug.name}</span>
                        {sug.category && (
                          <span className="text-[10px] text-brand-muted">{sug.category}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Input
                label="Required Quantity"
                type="number"
                min={1}
                value={itemQty}
                onChange={(e) => setItemQty(Number(e.target.value))}
              />

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => setShowAddItem(false)}>
                  Cancel
                </Button>
                <Button
                  variant="urgent"
                  disabled={!itemName.trim() || addItemMutation.isPending}
                  loading={addItemMutation.isPending}
                  onClick={() => addItemMutation.mutate()}
                >
                  Add Item
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: MAKE RECURRING */}
        {showRecurrenceModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-brand-border rounded-lg p-6 max-w-sm w-full space-y-4">
              <h2 className="font-headline font-bold text-base uppercase">Set Recurrence Schedule</h2>
              <div>
                <label className="block text-[10px] font-headline font-bold uppercase text-brand-muted mb-1">
                  Frequency
                </label>
                <select
                  value={recurrenceFreq}
                  onChange={(e) => setRecurrenceFreq(e.target.value as any)}
                  className="w-full border border-brand-border p-2 bg-white text-xs"
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="BIWEEKLY">Biweekly (Every 2 weeks)</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>

              <Input
                label="Interval (e.g. Every N weeks)"
                type="number"
                min={1}
                value={recurrenceInterval}
                onChange={(e) => setRecurrenceInterval(Number(e.target.value))}
              />

              <Input
                label="Number of Occurrences"
                type="number"
                min={2}
                max={52}
                value={recurrenceOccurrences}
                onChange={(e) => setRecurrenceOccurrences(Number(e.target.value))}
              />

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => setShowRecurrenceModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="urgent"
                  loading={createRecurrenceMutation.isPending}
                  onClick={() => createRecurrenceMutation.mutate()}
                >
                  Create Series
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: SAVE AS TEMPLATE */}
        {showTemplateModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-brand-border rounded-lg p-6 max-w-sm w-full space-y-4">
              <h2 className="font-headline font-bold text-base uppercase">Save as Reusable Template</h2>
              <Input
                label="Template Name"
                required
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Away Match Blueprint"
              />
              <Input
                label="Description (Optional)"
                value={templateDesc}
                onChange={(e) => setTemplateDesc(e.target.value)}
                placeholder="Standard manifest for tournament weekends"
              />
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => setShowTemplateModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="urgent"
                  disabled={!templateName.trim() || saveAsTemplateMutation.isPending}
                  loading={saveAsTemplateMutation.isPending}
                  onClick={() => saveAsTemplateMutation.mutate()}
                >
                  Save Template
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CREATE ROLE */}
        {showCreateRole && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-brand-border rounded-lg p-6 max-w-sm w-full space-y-4">
              <h2 className="font-headline font-bold text-base uppercase">Create Event Role</h2>
              <Input
                label="Role Title"
                required
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Field Medic, Captain, Kit Manager"
              />
              <Input
                label="Description"
                value={roleDesc}
                onChange={(e) => setRoleDesc(e.target.value)}
                placeholder="Responsibilities and specific gear..."
              />
              <Input
                label="Required Count"
                type="number"
                min={1}
                value={roleRequiredCount}
                onChange={(e) => setRoleRequiredCount(Number(e.target.value))}
              />
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => setShowCreateRole(false)}>
                  Cancel
                </Button>
                <Button
                  variant="urgent"
                  disabled={!roleName.trim() || createRoleMutation.isPending}
                  loading={createRoleMutation.isPending}
                  onClick={() => createRoleMutation.mutate()}
                >
                  Create Role
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
