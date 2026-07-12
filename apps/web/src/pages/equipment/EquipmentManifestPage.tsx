import { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import api from '@/lib/api';
import type { SharedItem, GroupActivity } from '@/types';

export function EquipmentManifestPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const activityIdFromParam = searchParams.get('activityId');

  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('1');
  const [addError, setAddError] = useState('');

  // If activityId not in URL, fetch first activity for the group
  const { data: activities } = useQuery<GroupActivity[]>({
    queryKey: ['group-activities', groupId],
    queryFn: () =>
      api.get(`/groups/${groupId}/activities`).then((r) => r.data),
    enabled: !!groupId && !activityIdFromParam,
  });

  const activityId = activityIdFromParam ?? activities?.[0]?.id ?? null;
  const activityName =
    activities?.find((a) => a.id === activityId)?.name ?? '';

  const {
    data: items,
    isLoading,
    error,
  } = useQuery<SharedItem[]>({
    queryKey: ['shared-items', activityId],
    queryFn: () =>
      api.get(`/activities/${activityId}/shared-items`).then((r) => r.data),
    enabled: !!activityId,
  });

  const patchMutation = useMutation({
    mutationFn: ({
      itemId,
      requiredQuantity,
    }: {
      itemId: string;
      requiredQuantity: number;
    }) =>
      api
        .patch(`/activities/${activityId}/shared-items/${itemId}`, {
          requiredQuantity,
        })
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-items', activityId] });
    },
  });

  const addMutation = useMutation({
    mutationFn: (body: { name: string; requiredQuantity: number }) =>
      api
        .post(`/activities/${activityId}/shared-items`, body)
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-items', activityId] });
      setShowAddForm(false);
      setNewItemName('');
      setNewItemQty('1');
      setAddError('');
    },
    onError: () => {
      setAddError('Failed to add item. Please try again.');
    },
  });

  const handleQtyChange = (item: SharedItem, delta: number) => {
    const next = Math.max(1, item.requiredQuantity + delta);
    patchMutation.mutate({ itemId: item.id, requiredQuantity: next });
  };

  const handleAddItem = () => {
    if (!newItemName.trim()) {
      setAddError('Item name is required.');
      return;
    }
    const qty = parseInt(newItemQty, 10);
    if (isNaN(qty) || qty < 1) {
      setAddError('Quantity must be at least 1.');
      return;
    }
    addMutation.mutate({ name: newItemName.trim(), requiredQuantity: qty });
  };

  const filtered = (items ?? []).filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <PageLayout>
      {/* Header */}
      <div className="pt-6 pb-2">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => navigate(-1)}
            className="font-headline font-bold text-brand-text text-lg leading-none"
            aria-label="Go back"
          >
            ←
          </button>
          <div>
            <h1 className="font-headline font-bold text-xl uppercase tracking-wider text-brand-text leading-tight">
              ITEM MANIFEST
            </h1>
            {activityName && (
              <p className="font-body text-sm text-brand-muted">{activityName}</p>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-headline text-xs uppercase tracking-wider text-brand-muted">
            MANIFEST ID: {activityId ? activityId.slice(0, 8).toUpperCase() : '—'}
          </span>
          <span className="font-headline text-xs uppercase tracking-wider text-brand-muted">
            EST. WEIGHT: 12.4 KG
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="mt-3 mb-4">
        <Input
          placeholder="SEARCH ITEMS..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="font-headline text-sm uppercase tracking-wider"
        />
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      )}

      {error && (
        <div className="border border-error rounded-lg p-4 text-error font-body text-sm">
          Failed to load items. Please try again.
        </div>
      )}

      {/* Item List */}
      {!isLoading && !error && (
        <div className="border border-brand-border rounded-lg bg-white overflow-hidden">
          {filtered.length === 0 && !showAddForm && (
            <div className="p-6 text-center text-brand-muted font-body text-sm">
              {search ? 'No items match your search.' : 'No items yet. Add the first one below.'}
            </div>
          )}

          {filtered.map((item, index) => (
            <div key={item.id} className={index < filtered.length - 1 ? 'border-b border-brand-border' : ''}>
              <div className="flex items-center justify-between p-4 gap-4">
                {/* Left: name + description */}
                <div className="flex-1 min-w-0">
                  <p className="font-headline text-xs uppercase tracking-wider text-brand-muted mb-0.5">
                    #{String(index + 1).padStart(3, '0')}
                  </p>
                  <p className="font-headline font-bold text-base uppercase tracking-wide text-brand-text truncate">
                    {item.name}
                  </p>
                  {item.description && (
                    <p className="font-body text-sm text-brand-muted mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  {item.unit && (
                    <p className="font-body text-xs text-brand-muted mt-0.5 uppercase">
                      UNIT: {item.unit}
                    </p>
                  )}
                </div>

                {/* Right: qty display + controls */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="font-headline font-bold text-3xl text-brand-text leading-none">
                    {item.requiredQuantity}
                  </span>
                  <div className="flex items-center gap-1 mt-1">
                    <button
                      onClick={() => handleQtyChange(item, -1)}
                      disabled={item.requiredQuantity <= 1 || patchMutation.isPending}
                      className="w-8 h-8 flex items-center justify-center border border-brand-border font-headline font-bold text-brand-text disabled:opacity-40"
                      aria-label={`Decrease quantity for ${item.name}`}
                    >
                      −
                    </button>
                    <button
                      onClick={() => handleQtyChange(item, 1)}
                      disabled={patchMutation.isPending}
                      className="w-8 h-8 flex items-center justify-center border border-brand-border font-headline font-bold text-brand-text disabled:opacity-40"
                      aria-label={`Increase quantity for ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Inline add form */}
          {showAddForm && (
            <div className="border-t border-brand-border p-4 bg-brand-bg">
              <p className="font-headline text-xs uppercase tracking-wider text-brand-muted mb-3">
                NEW ITEM
              </p>
              <div className="flex flex-col gap-3">
                <Input
                  label="Item Name"
                  value={newItemName}
                  onChange={(e) => {
                    setNewItemName(e.target.value);
                    setAddError('');
                  }}
                  placeholder="e.g. Soccer Ball"
                />
                <Input
                  label="Quantity"
                  type="number"
                  min="1"
                  value={newItemQty}
                  onChange={(e) => {
                    setNewItemQty(e.target.value);
                    setAddError('');
                  }}
                />
                {addError && (
                  <p className="text-error text-xs font-body">{addError}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="urgent"
                    onClick={handleAddItem}
                    loading={addMutation.isPending}
                    className="flex-1"
                  >
                    ADD ITEM
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowAddForm(false);
                      setNewItemName('');
                      setNewItemQty('1');
                      setAddError('');
                    }}
                    className="flex-1"
                  >
                    CANCEL
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Request custom item button */}
          {!showAddForm && (
            <div className="border-t border-brand-border p-4">
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full font-headline font-bold text-sm uppercase tracking-wider text-brand-muted py-2 flex items-center justify-center gap-2"
              >
                + REQUEST CUSTOM ITEM
              </button>
            </div>
          )}
        </div>
      )}

      {/* Spacer for sticky button */}
      <div className="h-24" />

      {/* Sticky footer CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] px-4 pb-6 pt-3 bg-brand-bg border-t border-brand-border z-10">
        <Button
          variant="urgent"
          fullWidth
          size="lg"
          onClick={() => navigate(`/groups/${groupId}/invite`)}
        >
          FINISH &amp; INVITE →
        </Button>
      </div>
    </PageLayout>
  );
}
