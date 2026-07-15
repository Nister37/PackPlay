import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { StatusChip } from '@/components/ui/StatusChip';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useItemCoverage } from '@/hooks/useEquipment';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import type { SharedResponsibility } from '@/types';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function mapResponsibilityStatus(
  status: SharedResponsibility['status'],
): 'packed' | 'claimed' | 'in-progress' {
  if (status === 'PACKED') return 'packed';
  if (status === 'COMMITTED') return 'claimed';
  return 'in-progress';
}

export function SharedItemPage() {
  const { itemId } = useParams<{ groupId: string; itemId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [claimQty, setClaimQty] = useState('1');
  const [extraQty, setExtraQty] = useState('1');
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [showExtraForm, setShowExtraForm] = useState(false);
  const [actionError, setActionError] = useState('');

  const {
    data: coverage,
    isLoading,
    error,
  } = useItemCoverage(itemId ?? null);

  const userResponsibility = coverage?.responsibilities.find(
    (r: SharedResponsibility) => r.userId === user?.id,
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['coverage', itemId] });
  };

  const claimMutation = useMutation({
    mutationFn: (quantity: number) =>
      api.post(`/shared-items/${itemId}/claim`, { quantity }).then((r) => r.data),
    onSuccess: () => {
      invalidate();
      setShowClaimForm(false);
      setActionError('');
    },
    onError: () => setActionError('Failed to claim. Please try again.'),
  });

  const packMutation = useMutation({
    mutationFn: (quantity: number) =>
      api.post(`/shared-items/${itemId}/pack`, { quantity }).then((r) => r.data),
    onSuccess: () => {
      invalidate();
      setActionError('');
    },
    onError: () => setActionError('Failed to mark as packed. Please try again.'),
  });

  const releaseMutation = useMutation({
    mutationFn: () =>
      api.post(`/shared-items/${itemId}/release`).then((r) => r.data),
    onSuccess: () => {
      invalidate();
      setActionError('');
    },
    onError: () => setActionError('Failed to release. Please try again.'),
  });

  const handleClaim = () => {
    const qty = parseInt(claimQty, 10);
    if (isNaN(qty) || qty < 1) {
      setActionError('Enter a valid quantity.');
      return;
    }
    claimMutation.mutate(qty);
  };

  const handleBringExtra = () => {
    const qty = parseInt(extraQty, 10);
    if (isNaN(qty) || qty < 1) {
      setActionError('Enter a valid quantity.');
      return;
    }
    claimMutation.mutate(qty);
  };

  const item = coverage?.item;
  const unit = item?.unit ?? 'unit(s)';
  const coveredQty = coverage?.coveredQuantity ?? 0;
  const requiredQty = item?.requiredQuantity ?? 0;
  const missingQty = coverage?.missingQuantity ?? 0;
  const isCovered = coverage?.isCovered ?? false;

  return (
    <PageLayout>
      {/* Header */}
      <div className="pt-6 pb-2 flex items-start gap-3">
        <button
          onClick={() => navigate(-1)}
          className="font-headline font-bold text-brand-text text-lg leading-none mt-1"
          aria-label="Go back"
        >
          ←
        </button>
        <div>
          {isLoading ? (
            <div className="h-7 w-40 bg-brand-border/10 rounded animate-pulse" />
          ) : (
            <h1 className="font-headline font-bold text-2xl uppercase tracking-wider text-brand-text leading-tight">
              {item?.name ?? 'ITEM'}
            </h1>
          )}
          {item?.description && (
            <p className="font-body text-sm text-brand-muted mt-0.5">
              {item.description}
            </p>
          )}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border border-error rounded-lg p-4 text-error font-body text-sm mt-4">
          Failed to load item details. Please try again.
        </div>
      )}

      {!isLoading && !error && coverage && (
        <>
          {/* Coverage summary */}
          <div className="mt-4 mb-5">
            <p className="font-headline font-bold text-3xl text-brand-text uppercase tracking-wide">
              {coveredQty} OF {requiredQty}{' '}
              <span className="text-xl">{unit.toUpperCase()}</span>
            </p>
            <p className="font-headline text-xs uppercase tracking-wider text-brand-muted mt-1">
              COVERED
            </p>
            <div className="mt-3 border border-brand-border overflow-hidden" style={{ height: '8px' }}>
              <div
                className="h-full bg-secondary transition-all duration-300"
                style={{ width: `${Math.min(100, (coveredQty / Math.max(1, requiredQty)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Missing alert */}
          {!isCovered && missingQty > 0 && (
            <Card className="mb-4 bg-primary/10 border-primary">
              <p className="font-headline font-bold text-sm uppercase tracking-wider text-primary">
                MISSING: {missingQty} {unit.toUpperCase()} NEEDED
              </p>
            </Card>
          )}

          {/* Responsibilities */}
          <div className="border border-brand-border rounded-lg bg-white overflow-hidden mb-4">
            {coverage.responsibilities.length === 0 && (
              <div className="p-5 text-center text-brand-muted font-body text-sm">
                No one has claimed this item yet.
              </div>
            )}
            {coverage.responsibilities.map(
              (resp: SharedResponsibility, idx: number) => {
                const isLast = idx === coverage.responsibilities.length - 1;
                const chipStatus = mapResponsibilityStatus(resp.status);
                const isPacked = resp.status === 'PACKED';
                const isReleased = [
                  'RELEASED',
                  'FORGOT',
                  'COULD_NOT_BRING',
                  'REPLACEMENT_ARRANGED',
                ].includes(resp.status);

                return (
                  <div
                    key={resp.id}
                    className={`flex items-center gap-3 p-4 ${!isLast ? 'border-b border-brand-border' : ''} ${isReleased ? 'opacity-50' : ''}`}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full border border-brand-border bg-brand-bg flex items-center justify-center shrink-0">
                      <span className="font-headline font-bold text-sm text-brand-text">
                        {getInitials(resp.user.name)}
                      </span>
                    </div>

                    {/* Name + qty */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-headline font-bold text-sm uppercase tracking-wide text-brand-text truncate">
                          {resp.user.name}
                        </p>
                        {isPacked && (
                          <span className="text-secondary font-bold text-sm">✓</span>
                        )}
                      </div>
                      <p className="font-body text-xs text-brand-muted mt-0.5">
                        {resp.quantity} {unit}
                      </p>
                    </div>

                    {/* Status chip */}
                    <StatusChip
                      status={chipStatus}
                      label={resp.status.replace(/_/g, ' ')}
                    />
                  </div>
                );
              },
            )}
          </div>

          {/* Storage instructions */}
          {item?.description && (
            <Card className="mb-4">
              <p className="font-headline text-xs uppercase tracking-wider text-brand-muted mb-1">
                STORAGE INSTRUCTIONS
              </p>
              <p className="font-body text-sm text-brand-text">{item.description}</p>
            </Card>
          )}

          {/* Action error */}
          {actionError && (
            <p className="text-error text-xs font-body mb-3">{actionError}</p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 pb-8">
            {/* No claim yet */}
            {!userResponsibility && (
              <>
                {showClaimForm ? (
                  <div className="flex flex-col gap-3 border border-brand-border rounded-lg p-4 bg-white">
                    <p className="font-headline text-xs uppercase tracking-wider text-brand-muted">
                      HOW MANY WILL YOU BRING?
                    </p>
                    <Input
                      label={`Quantity (${unit})`}
                      type="number"
                      min="1"
                      value={claimQty}
                      onChange={(e) => {
                        setClaimQty(e.target.value);
                        setActionError('');
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="urgent"
                        onClick={handleClaim}
                        loading={claimMutation.isPending}
                        className="flex-1"
                      >
                        CONFIRM CLAIM
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setShowClaimForm(false);
                          setActionError('');
                        }}
                        className="flex-1"
                      >
                        CANCEL
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="urgent"
                    fullWidth
                    onClick={() => setShowClaimForm(true)}
                  >
                    CLAIM {unit.toUpperCase()}
                  </Button>
                )}
              </>
            )}

            {/* Has claim, not packed */}
            {userResponsibility && userResponsibility.status === 'COMMITTED' && (
              <Button
                variant="primary"
                fullWidth
                onClick={() => packMutation.mutate(userResponsibility.quantity)}
                loading={packMutation.isPending}
                className="bg-secondary border-secondary"
              >
                MARK AS PACKED ✓
              </Button>
            )}

            {/* Release button (if claimed) */}
            {userResponsibility &&
              !['RELEASED', 'FORGOT', 'COULD_NOT_BRING', 'REPLACEMENT_ARRANGED'].includes(
                userResponsibility.status,
              ) && (
                <Button
                  variant="ghost"
                  fullWidth
                  onClick={() => releaseMutation.mutate()}
                  loading={releaseMutation.isPending}
                >
                  RELEASE
                </Button>
              )}

            {/* Bring extra */}
            {showExtraForm ? (
              <div className="flex flex-col gap-3 border border-brand-border rounded-lg p-4 bg-white">
                <p className="font-headline text-xs uppercase tracking-wider text-brand-muted">
                  BRING EXTRA
                </p>
                <Input
                  label={`Extra quantity (${unit})`}
                  type="number"
                  min="1"
                  value={extraQty}
                  onChange={(e) => {
                    setExtraQty(e.target.value);
                    setActionError('');
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={handleBringExtra}
                    loading={claimMutation.isPending}
                    className="flex-1"
                  >
                    CONFIRM EXTRA
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowExtraForm(false);
                      setActionError('');
                    }}
                    className="flex-1"
                  >
                    CANCEL
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                fullWidth
                onClick={() => setShowExtraForm(true)}
              >
                BRING EXTRA
              </Button>
            )}
          </div>
        </>
      )}
    </PageLayout>
  );
}
