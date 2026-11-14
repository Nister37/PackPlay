import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import api from '@/lib/api';
import type { InventoryQrResolution, AssetCondition } from '@/types';

export function InventoryQrResolutionPage() {
  const { token = '' } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [returnNotes, setReturnNotes] = useState('');
  const [returnCondition, setReturnCondition] = useState<AssetCondition>('GOOD');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<InventoryQrResolution>({
    queryKey: ['qr-resolution', token],
    queryFn: () => api.get(`/inventory-qr/${token}`).then((r) => r.data),
    enabled: !!token,
  });

  const returnMutation = useMutation({
    mutationFn: async (custodyId: string) => {
      const resolvedItem = data?.item || (data as any)?.stock?.inventoryItem;
      const groupId = resolvedItem?.groupId;
      return api.post(`/groups/${groupId}/inventory-operations/custodies/${custodyId}/return`, {
        quantity: 1,
        condition: returnCondition,
        notes: returnNotes.trim() || undefined,
      });
    },
    onSuccess: () => {
      setSuccessMessage('Equipment returned successfully!');
      queryClient.invalidateQueries({ queryKey: ['qr-resolution', token] });
    },
  });

  if (isLoading) {
    return (
      <PageLayout>
        <div className="py-20 flex flex-col items-center justify-center">
          <LoadingSpinner size="lg" />
          <p className="font-headline text-xs uppercase tracking-widest text-brand-muted mt-4">
            Resolving Inventory QR Token...
          </p>
        </div>
      </PageLayout>
    );
  }

  if (error || !data) {
    return (
      <PageLayout>
        <div className="py-12 max-w-md mx-auto text-center">
          <div className="bg-white border border-[#BA1A1A] p-6 rounded-lg mb-4">
            <h2 className="font-headline font-bold text-base text-[#BA1A1A] uppercase mb-1">
              QR Code Invalid or Expired
            </h2>
            <p className="font-body text-xs text-brand-muted">
              This inventory token could not be resolved or you do not have permission to view it.
            </p>
          </div>
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            Return to Dashboard
          </Button>
        </div>
      </PageLayout>
    );
  }

  const targetType = data.targetType || (data as any).kind || 'ITEM';
  const item = data.item || (data as any).stock?.inventoryItem;
  const asset = data.asset || ((data as any).stock?.assetTag ? (data as any).stock : undefined);
  const location = data.location || (data as any).stock?.location;
  const activeCustody = data.activeCustody || (data as any).stock?.custodies?.[0] || null;

  return (
    <PageLayout>
      <div className="py-6 space-y-6 max-w-lg mx-auto">
        <header className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="font-headline font-bold text-sm uppercase underline"
          >
            <span className="inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Back</span>
          </button>
          <div>
            <h1 className="font-headline font-bold text-xl uppercase tracking-wider text-brand-text">
              QR Equipment Scan
            </h1>
            <p className="font-body text-xs text-brand-muted">
              Target: {targetType} · Token: {token.slice(0, 8)}...
            </p>
          </div>
        </header>

        {successMessage && (
          <div className="bg-white border border-[#2D6A4F] p-4 rounded-lg">
            <p className="font-body text-sm text-[#2D6A4F] font-bold">{successMessage}</p>
          </div>
        )}

        {/* Resolved Target Card */}
        <div className="bg-white border border-brand-border rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline font-bold text-lg uppercase text-brand-text">
              {item?.name || location?.name || 'Inventory Asset'}
            </h2>
            <span className="font-headline text-[10px] uppercase px-2 py-0.5 bg-[#1A1A1A] text-white rounded">
              {targetType}
            </span>
          </div>

          {item && (
            <div className="space-y-1 text-xs font-body">
              <p>
                <span className="font-headline text-brand-muted uppercase">Category: </span>
                {item.category || 'General'}
              </p>
              <p>
                <span className="font-headline text-brand-muted uppercase">Available Stock: </span>
                <span className="font-bold text-[#2D6A4F]">{item.availableQuantity}</span> /{' '}
                {item.totalQuantity} {item.unit || 'pcs'}
              </p>
            </div>
          )}

          {asset && (
            <div className="space-y-1 text-xs font-body border-t border-brand-border pt-2">
              <p>
                <span className="font-headline text-brand-muted uppercase">Asset Tag: </span>
                <span className="font-mono font-bold">{asset.assetTag || 'None'}</span>
              </p>
              <p>
                <span className="font-headline text-brand-muted uppercase">Serial: </span>
                <span className="font-mono">{asset.serialNumber || '—'}</span>
              </p>
              <p>
                <span className="font-headline text-brand-muted uppercase">Condition: </span>
                <span className="font-bold">{asset.condition}</span>
              </p>
              <p>
                <span className="font-headline text-brand-muted uppercase">Status: </span>
                <span className="font-bold">{asset.status}</span>
              </p>
            </div>
          )}

          {location && (
            <div className="text-xs font-body border-t border-brand-border pt-2">
              <p>
                <span className="font-headline text-brand-muted uppercase">Storage Description: </span>
                {location.description || 'No description'}
              </p>
            </div>
          )}
        </div>

        {/* Custody Information */}
        <div className="bg-white border border-brand-border rounded-lg p-5 space-y-3">
          <h3 className="font-headline font-bold text-xs uppercase tracking-wider text-brand-muted">
            Custody Status
          </h3>

          {activeCustody ? (
            <div className="space-y-3">
              <div className="p-3 bg-primary/10 border border-primary rounded text-xs">
                <p className="font-headline font-bold uppercase text-primary">Currently Checked Out</p>
                <p className="font-body text-brand-text mt-0.5">
                  Holder: <strong>{activeCustody.user?.name || (activeCustody as any).holder?.name || 'Group Member'}</strong>
                  {((activeCustody.user?.email || (activeCustody as any).holder?.email) ? ` (${activeCustody.user?.email || (activeCustody as any).holder?.email})` : '')}
                </p>
                <p className="font-body text-brand-muted mt-0.5">
                  Checked out:{' '}
                  {activeCustody.checkedOutAt
                    ? new Date(activeCustody.checkedOutAt).toLocaleDateString()
                    : 'N/A'}
                </p>
                {activeCustody.expectedReturnAt && (
                  <p className="font-body text-brand-muted">
                    Due Date: {new Date(activeCustody.expectedReturnAt).toLocaleDateString()}
                  </p>
                )}
              </div>

              {/* One-tap return section */}
              <div className="space-y-2 border-t border-brand-border pt-3">
                <label className="block text-[10px] font-headline font-bold uppercase text-brand-muted">
                  Condition Upon Return
                </label>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value as AssetCondition)}
                  className="w-full border border-brand-border p-2 bg-white text-xs"
                >
                  <option value="EXCELLENT">Excellent</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair (Normal wear)</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="LOST">Lost / Missing</option>
                </select>

                <input
                  type="text"
                  placeholder="Return notes (optional)..."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="w-full border border-brand-border p-2 text-xs"
                />

                <Button
                  variant="urgent"
                  fullWidth
                  loading={returnMutation.isPending}
                  onClick={() => returnMutation.mutate(activeCustody.id)}
                >
                  Return to Inventory Now
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-[#2D6A4F]/10 border border-[#2D6A4F] rounded text-center">
              <p className="font-headline font-bold text-xs uppercase text-[#2D6A4F]">
                In Storage / Available
              </p>
              <p className="font-body text-xs text-brand-muted mt-1">
                Item is not currently checked out to any member.
              </p>
              {item && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate(`/groups/${item.groupId}/inventory`)}
                >
                  Open Team Inventory
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
