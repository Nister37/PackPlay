import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import type {
  InventoryItem,
  InventoryCustody,
  InventoryHistoryEntry,
  StorageLocation,
  GroupMember,
  AssetCondition,
} from '@/types';

type Tab = 'catalogue' | 'custody' | 'history' | 'locations';

export function TeamInventoryPage() {
  const { groupId = '' } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('catalogue');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Forms state
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemTracking, setNewItemTracking] = useState<'ASSET' | 'BATCH'>('BATCH');
  const [newItemUnit, setNewItemUnit] = useState('pcs');
  const [newItemMinQty, setNewItemMinQty] = useState(0);

  // Add batch state
  const [batchItemId, setBatchItemId] = useState<string | null>(null);
  const [batchQty, setBatchQty] = useState(1);
  const [batchNumber, setBatchNumber] = useState('');
  const [batchLocationId, setBatchLocationId] = useState('');

  // Add asset state
  const [assetItemId, setAssetItemId] = useState<string | null>(null);
  const [assetTag, setAssetTag] = useState('');
  const [assetSerial, setAssetSerial] = useState('');
  const [assetLocationId, setAssetLocationId] = useState('');

  // Checkout state
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutItemId, setCheckoutItemId] = useState('');
  const [checkoutUserId, setCheckoutUserId] = useState('');
  const [checkoutQty, setCheckoutQty] = useState(1);
  const [checkoutAssetId, setCheckoutAssetId] = useState('');
  const [checkoutBatchId, setCheckoutBatchId] = useState('');
  const [checkoutDueDays, setCheckoutDueDays] = useState(7);

  // Return state
  const [returnCustodyId, setReturnCustodyId] = useState<string | null>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [returnCondition, setReturnCondition] = useState<AssetCondition>('GOOD');
  const [returnNotes, setReturnNotes] = useState('');

  // Damage / condition report state
  const [showDamageReport, setShowDamageReport] = useState(false);
  const [damageItemId, setDamageItemId] = useState('');
  const [damageAssetId, setDamageAssetId] = useState('');
  const [damageCondition, setDamageCondition] = useState<AssetCondition>('DAMAGED');
  const [damageNotes, setDamageNotes] = useState('');

  // Location state
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationDesc, setNewLocationDesc] = useState('');

  // QR Modal
  const [generatedQr, setGeneratedQr] = useState<{
    token?: string;
    qrUrl: string;
    qrDataUrl?: string;
  } | null>(null);

  // Queries
  const { data: members } = useQuery<GroupMember[]>({
    queryKey: ['members', groupId],
    queryFn: () => api.get(`/groups/${groupId}/members`).then((r) => r.data),
    enabled: !!groupId,
  });

  const { data: inventoryData, isLoading: itemsLoading } = useQuery<{
    data: InventoryItem[];
    meta: { total: number };
  }>({
    queryKey: ['team-inventory', groupId, search, selectedCategory],
    queryFn: () =>
      api
        .get(`/groups/${groupId}/inventory`, {
          params: { search: search || undefined, category: selectedCategory || undefined },
        })
        .then((r) => r.data),
    enabled: !!groupId,
  });

  const { data: locations } = useQuery<StorageLocation[]>({
    queryKey: ['inventory-locations', groupId],
    queryFn: () => api.get(`/groups/${groupId}/inventory/locations/all`).then((r) => r.data),
    enabled: !!groupId,
  });

  const { data: overdueCustodies } = useQuery<InventoryCustody[]>({
    queryKey: ['inventory-overdue', groupId],
    queryFn: () => api.get(`/groups/${groupId}/inventory-overdue`).then((r) => r.data),
    enabled: !!groupId && (activeTab === 'custody' || activeTab === 'history'),
  });

  const { data: historyEntries, isLoading: historyLoading } = useQuery<{
    data: InventoryHistoryEntry[];
  }>({
    queryKey: ['inventory-history', groupId],
    queryFn: () => api.get(`/groups/${groupId}/inventory-history`).then((r) => r.data),
    enabled: !!groupId && activeTab === 'history',
  });

  const myRole = members?.find((m) => m.userId === user?.id)?.role;
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  // Mutations
  const createItemMutation = useMutation({
    mutationFn: () =>
      api.post(`/groups/${groupId}/inventory`, {
        name: newItemName.trim(),
        category: newItemCategory.trim() || undefined,
        trackingType: newItemTracking,
        unit: newItemUnit.trim() || 'pcs',
        minimumQuantity: Number(newItemMinQty) || 0,
      }),
    onSuccess: () => {
      setShowAddItem(false);
      setNewItemName('');
      setNewItemCategory('');
      queryClient.invalidateQueries({ queryKey: ['team-inventory', groupId] });
    },
  });

  const createBatchMutation = useMutation({
    mutationFn: (itemId: string) =>
      api.post(`/groups/${groupId}/inventory/${itemId}/batches`, {
        quantity: Number(batchQty),
        batchNumber: batchNumber.trim() || undefined,
        locationId: batchLocationId || undefined,
      }),
    onSuccess: () => {
      setBatchItemId(null);
      setBatchQty(1);
      setBatchNumber('');
      queryClient.invalidateQueries({ queryKey: ['team-inventory', groupId] });
    },
  });

  const createAssetMutation = useMutation({
    mutationFn: (itemId: string) =>
      api.post(`/groups/${groupId}/inventory/${itemId}/assets`, {
        assetTag: assetTag.trim() || undefined,
        serialNumber: assetSerial.trim() || undefined,
        locationId: assetLocationId || undefined,
        condition: 'GOOD',
      }),
    onSuccess: () => {
      setAssetItemId(null);
      setAssetTag('');
      setAssetSerial('');
      queryClient.invalidateQueries({ queryKey: ['team-inventory', groupId] });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + checkoutDueDays);
      return api.post(`/groups/${groupId}/inventory-operations/checkouts`, {
        itemId: checkoutItemId,
        userId: checkoutUserId,
        quantity: Number(checkoutQty) || 1,
        assetId: checkoutAssetId || undefined,
        batchId: checkoutBatchId || undefined,
        expectedReturnAt: dueDate.toISOString(),
      });
    },
    onSuccess: () => {
      setShowCheckout(false);
      setCheckoutItemId('');
      queryClient.invalidateQueries({ queryKey: ['team-inventory', groupId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-overdue', groupId] });
    },
  });

  const returnMutation = useMutation({
    mutationFn: (custodyId: string) =>
      api.post(`/groups/${groupId}/inventory-operations/custodies/${custodyId}/return`, {
        quantity: Number(returnQty) || 1,
        condition: returnCondition,
        notes: returnNotes.trim() || undefined,
      }),
    onSuccess: () => {
      setReturnCustodyId(null);
      queryClient.invalidateQueries({ queryKey: ['team-inventory', groupId] });
      queryClient.invalidateQueries({ queryKey: ['inventory-overdue', groupId] });
    },
  });

  const conditionMutation = useMutation({
    mutationFn: () =>
      api.post(`/groups/${groupId}/inventory-operations/condition-reports`, {
        itemId: damageItemId,
        assetId: damageAssetId || undefined,
        condition: damageCondition,
        notes: damageNotes,
      }),
    onSuccess: () => {
      setShowDamageReport(false);
      setDamageNotes('');
      queryClient.invalidateQueries({ queryKey: ['team-inventory', groupId] });
    },
  });

  const createLocationMutation = useMutation({
    mutationFn: () =>
      api.post(`/groups/${groupId}/inventory/locations`, {
        name: newLocationName.trim(),
        description: newLocationDesc.trim() || undefined,
      }),
    onSuccess: () => {
      setShowAddLocation(false);
      setNewLocationName('');
      setNewLocationDesc('');
      queryClient.invalidateQueries({ queryKey: ['inventory-locations', groupId] });
    },
  });

  const generateQrMutation = useMutation({
    mutationFn: async (payload: { batchId?: string; assetId?: string }) => {
      const res = await api.post(`/groups/${groupId}/inventory-qr`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      setGeneratedQr({
        token: data.token,
        qrUrl: data.url || (data.token ? `${window.location.origin}/inventory/scan/${data.token}` : window.location.href),
        qrDataUrl: data.qrDataUrl,
      });
    },
  });

  const handleDownloadCsv = async () => {
    try {
      const response = await api.get(`/groups/${groupId}/inventory-history.csv`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `inventory-history-${groupId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch {
      alert('Failed to download CSV');
    }
  };

  const items = inventoryData?.data ?? [];

  return (
    <PageLayout>
      <div className="py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => navigate(`/groups/${groupId}`)}
                className="font-headline font-bold text-sm uppercase underline text-brand-text"
              >
                <span className="inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" /> Group</span>
              </button>
              <span className="text-brand-muted">/</span>
              <span className="font-headline text-xs uppercase tracking-widest text-brand-muted">
                INVENTORY
              </span>
            </div>
            <h1 className="font-headline text-2xl font-bold uppercase tracking-wider text-brand-text">
              Team Inventory
            </h1>
            <p className="font-body text-xs text-brand-muted">
              Custody check-out, QR lookup, batch stock, and movement audit.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canManage && (
              <>
                <Button variant="urgent" size="sm" onClick={() => setShowAddItem(true)}>
                  + Add Item
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowCheckout(true)}>
                  Check Out
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowDamageReport(true)}>
              Report Damage
            </Button>
          </div>
        </header>

        {/* Overdue alert banner */}
        {overdueCustodies && overdueCustodies.length > 0 && (
          <div className="bg-[#BA1A1A]/10 border border-[#BA1A1A] p-4 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#BA1A1A] shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-headline font-bold text-xs uppercase text-[#BA1A1A]">
                {overdueCustodies.length} Overdue Items in Custody
              </h2>
              <p className="font-body text-xs text-brand-muted mt-0.5">
                Some checked-out team gear has not been returned by its scheduled due date.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {overdueCustodies.map((c) => (
                  <span
                    key={c.id}
                    className="inline-block bg-white border border-[#BA1A1A] text-[#BA1A1A] px-2 py-0.5 text-xs font-headline font-bold rounded"
                  >
                    {c.item?.name} ({c.user?.name})
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-brand-border">
          <button
            onClick={() => setActiveTab('catalogue')}
            className={`px-4 py-2 font-headline text-xs uppercase tracking-wider font-bold border-b-2 transition-colors ${
              activeTab === 'catalogue'
                ? 'border-primary text-primary'
                : 'border-transparent text-brand-muted hover:text-brand-text'
            }`}
          >
            Catalogue & Stock
          </button>
          <button
            onClick={() => setActiveTab('custody')}
            className={`px-4 py-2 font-headline text-xs uppercase tracking-wider font-bold border-b-2 transition-colors ${
              activeTab === 'custody'
                ? 'border-primary text-primary'
                : 'border-transparent text-brand-muted hover:text-brand-text'
            }`}
          >
            Custody & Returns
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 font-headline text-xs uppercase tracking-wider font-bold border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-brand-muted hover:text-brand-text'
            }`}
          >
            Movement Audit
          </button>
          <button
            onClick={() => setActiveTab('locations')}
            className={`px-4 py-2 font-headline text-xs uppercase tracking-wider font-bold border-b-2 transition-colors ${
              activeTab === 'locations'
                ? 'border-primary text-primary'
                : 'border-transparent text-brand-muted hover:text-brand-text'
            }`}
          >
            Storage Locations
          </button>
        </div>

        {/* TAB 1: CATALOGUE & STOCK */}
        {activeTab === 'catalogue' && (
          <div className="space-y-4">
            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Input
                  label="SEARCH INVENTORY"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by item name..."
                />
              </div>
              <div className="w-full sm:w-48">
                <label className="block text-[10px] font-headline font-bold uppercase tracking-widest text-brand-muted mb-1">
                  CATEGORY
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full border border-brand-border bg-white px-3 py-2 text-sm"
                >
                  <option value="">All Categories</option>
                  <option value="APPAREL">Apparel</option>
                  <option value="EQUIPMENT">Equipment</option>
                  <option value="MEDICAL">Medical</option>
                  <option value="TRAINING">Training</option>
                </select>
              </div>
            </div>

            {itemsLoading ? (
              <div className="py-12 flex justify-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : items.length === 0 ? (
              <div className="bg-white border border-brand-border rounded-lg p-8 text-center">
                <p className="font-headline font-bold text-sm uppercase text-brand-muted">
                  No inventory items found
                </p>
                <p className="font-body text-xs text-brand-muted mt-1">
                  Add team equipment and batches to start tracking custody.
                </p>
                {canManage && (
                  <Button
                    variant="urgent"
                    size="sm"
                    className="mt-4"
                    onClick={() => setShowAddItem(true)}
                  >
                    + Add First Item
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const isExpanded = expandedItemId === item.id;
                  const available = item.availableQuantity ?? 0;
                  const total = item.totalQuantity ?? 0;
                  const checkedOut = item.checkedOutQuantity ?? 0;
                  const reserved = item.reservedQuantity ?? 0;
                  const isLow = item.minimumQuantity && available < item.minimumQuantity;

                  return (
                    <div
                      key={item.id}
                      className="bg-white border border-brand-border rounded-lg overflow-hidden transition-all"
                    >
                      <div
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-brand-bg/40"
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-headline font-bold text-base uppercase text-brand-text truncate">
                              {item.name}
                            </h3>
                            <span className="font-headline text-[9px] uppercase px-1.5 py-0.5 border border-brand-border bg-brand-bg text-brand-muted">
                              {item.trackingType}
                            </span>
                            {item.category && (
                              <span className="font-headline text-[9px] uppercase px-1.5 py-0.5 bg-[#1A1A1A] text-white">
                                {item.category}
                              </span>
                            )}
                            {isLow && (
                              <span className="font-headline text-[9px] uppercase px-1.5 py-0.5 bg-[#BA1A1A] text-white font-bold">
                                LOW STOCK
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="font-body text-xs text-brand-muted mt-0.5 truncate">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {/* Stock counters */}
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <span className="font-headline font-bold text-base text-brand-text block leading-none">
                              {available} / {total}
                            </span>
                            <span className="font-headline text-[9px] uppercase tracking-widest text-brand-muted">
                              Available {item.unit || 'pcs'}
                            </span>
                          </div>
                          {checkedOut > 0 && (
                            <div className="text-right">
                              <span className="font-headline font-bold text-xs text-primary block leading-none">
                                {checkedOut}
                              </span>
                              <span className="font-headline text-[9px] uppercase tracking-widest text-brand-muted">
                                Out
                              </span>
                            </div>
                          )}
                          {reserved > 0 && (
                            <div className="text-right">
                              <span className="font-headline font-bold text-xs text-[#2D6A4F] block leading-none">
                                {reserved}
                              </span>
                              <span className="font-headline text-[9px] uppercase tracking-widest text-brand-muted">
                                Reserved
                              </span>
                            </div>
                          )}
                          <span className="text-brand-muted text-xs">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="p-4 bg-brand-bg/30 border-t border-brand-border space-y-4">
                          <div className="flex flex-wrap gap-2 justify-between items-center">
                            <span className="font-headline font-bold text-xs uppercase tracking-wider text-brand-muted">
                              Item Details & Stock Breakout
                            </span>
                            <div className="flex gap-2">
                              {canManage && (
                                <>
                                  {item.trackingType === 'BATCH' ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setBatchItemId(item.id)}
                                    >
                                      + Add Batch
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setAssetItemId(item.id)}
                                    >
                                      + Add Asset
                                    </Button>
                                  )}
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (item.trackingType === 'BATCH' && item.batches?.[0]) {
                                    generateQrMutation.mutate({ batchId: item.batches[0].id });
                                  } else if (item.trackingType === 'ASSET' && item.assets?.[0]) {
                                    generateQrMutation.mutate({ assetId: item.assets[0].id });
                                  }
                                }}
                              >
                                Print QR
                              </Button>
                            </div>
                          </div>

                          {/* Batches Table */}
                          {item.trackingType === 'BATCH' && (
                            <div>
                              {item.batches && item.batches.length > 0 ? (
                                <div className="bg-white border border-brand-border rounded overflow-hidden">
                                  <table className="w-full text-left text-xs font-body">
                                    <thead className="bg-[#1A1A1A] text-white font-headline text-[10px] uppercase">
                                      <tr>
                                        <th className="p-2">Batch #</th>
                                        <th className="p-2">Quantity</th>
                                        <th className="p-2">Available</th>
                                        <th className="p-2">Location</th>
                                        <th className="p-2">Created</th>
                                        <th className="p-2 text-right">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-brand-border">
                                      {item.batches.map((batch) => (
                                        <tr key={batch.id}>
                                          <td className="p-2 font-bold">
                                            {batch.batchNumber || 'Standard'}
                                          </td>
                                          <td className="p-2">{batch.quantity}</td>
                                          <td className="p-2 text-[#2D6A4F] font-bold">
                                            {batch.availableQuantity}
                                          </td>
                                          <td className="p-2">
                                            {batch.location?.name || 'Unassigned'}
                                          </td>
                                          <td className="p-2 text-brand-muted">
                                            {new Date(batch.createdAt).toLocaleDateString()}
                                          </td>
                                          <td className="p-2 text-right">
                                            <button
                                              onClick={() =>
                                                generateQrMutation.mutate({
                                                  batchId: batch.id,
                                                })
                                              }
                                              className="text-[10px] uppercase font-headline underline text-brand-text"
                                            >
                                              QR
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-brand-muted italic">
                                  No batches recorded yet. Add a batch to replenish stock.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Assets Table */}
                          {item.trackingType === 'ASSET' && (
                            <div>
                              {item.assets && item.assets.length > 0 ? (
                                <div className="bg-white border border-brand-border rounded overflow-hidden">
                                  <table className="w-full text-left text-xs font-body">
                                    <thead className="bg-[#1A1A1A] text-white font-headline text-[10px] uppercase">
                                      <tr>
                                        <th className="p-2">Tag</th>
                                        <th className="p-2">Serial</th>
                                        <th className="p-2">Status</th>
                                        <th className="p-2">Condition</th>
                                        <th className="p-2">Location</th>
                                        <th className="p-2 text-right">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-brand-border">
                                      {item.assets.map((asset) => (
                                        <tr key={asset.id}>
                                          <td className="p-2 font-bold">
                                            {asset.assetTag || 'Untagged'}
                                          </td>
                                          <td className="p-2">{asset.serialNumber || '—'}</td>
                                          <td className="p-2">
                                            <span
                                              className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-headline font-bold uppercase ${
                                                asset.status === 'AVAILABLE'
                                                  ? 'bg-[#2D6A4F]/10 text-[#2D6A4F]'
                                                  : asset.status === 'CHECKED_OUT'
                                                    ? 'bg-primary/10 text-primary'
                                                    : 'bg-brand-bg text-brand-muted'
                                              }`}
                                            >
                                              {asset.status}
                                            </span>
                                          </td>
                                          <td className="p-2">{asset.condition}</td>
                                          <td className="p-2">
                                            {asset.location?.name || 'Unassigned'}
                                          </td>
                                          <td className="p-2 text-right">
                                            <button
                                              onClick={() =>
                                                generateQrMutation.mutate({
                                                  assetId: asset.id,
                                                })
                                              }
                                              className="text-[10px] uppercase font-headline underline text-brand-text"
                                            >
                                              QR
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="text-xs text-brand-muted italic">
                                  No asset tags registered yet.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CUSTODY & RETURNS */}
        {activeTab === 'custody' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-headline font-bold text-sm uppercase text-brand-text">
                  Active Team Custodies
                </h2>
                <p className="font-body text-xs text-brand-muted">
                  Checked-out assets and batches awaiting return or transfer.
                </p>
              </div>
              {canManage && (
                <Button variant="urgent" size="sm" onClick={() => setShowCheckout(true)}>
                  + New Check-Out
                </Button>
              )}
            </div>

            {overdueCustodies && overdueCustodies.length > 0 ? (
              <div className="bg-white border border-brand-border rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs font-body">
                  <thead className="bg-[#1A1A1A] text-white font-headline text-[10px] uppercase">
                    <tr>
                      <th className="p-3">Item / Asset</th>
                      <th className="p-3">Borrower</th>
                      <th className="p-3">Qty</th>
                      <th className="p-3">Checked Out</th>
                      <th className="p-3">Due Date</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {overdueCustodies.map((custody) => (
                      <tr key={custody.id} className="hover:bg-brand-bg/30">
                        <td className="p-3">
                          <p className="font-bold text-sm text-brand-text">{custody.item?.name}</p>
                          {custody.asset?.assetTag && (
                            <p className="text-[10px] text-brand-muted font-headline">
                              Tag: {custody.asset.assetTag}
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          <p className="font-bold text-brand-text">{custody.user?.name}</p>
                          <p className="text-[10px] text-brand-muted">{custody.user?.email}</p>
                        </td>
                        <td className="p-3 font-bold">{custody.quantity}</td>
                        <td className="p-3 text-brand-muted">
                          {new Date(custody.checkedOutAt).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          {custody.expectedReturnAt ? (
                            <span
                              className={
                                new Date(custody.expectedReturnAt) < new Date()
                                  ? 'text-[#BA1A1A] font-bold'
                                  : 'text-brand-text'
                              }
                            >
                              {new Date(custody.expectedReturnAt).toLocaleDateString()}
                            </span>
                          ) : (
                            'No due date'
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setReturnCustodyId(custody.id);
                              setReturnQty(custody.quantity);
                            }}
                          >
                            Return
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-white border border-brand-border rounded-lg p-8 text-center">
                <p className="font-headline font-bold text-sm uppercase text-brand-muted">
                  No active custody records
                </p>
                <p className="font-body text-xs text-brand-muted mt-1">
                  All team equipment is currently safe in designated storage locations.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MOVEMENT AUDIT */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-headline font-bold text-sm uppercase text-brand-text">
                  Movement History & Audit Log
                </h2>
                <p className="font-body text-xs text-brand-muted">
                  Immutable chain of custody, batch additions, damage reports, and returns.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={handleDownloadCsv}>
                ⬇ Export CSV
              </Button>
            </div>

            {historyLoading ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner size="md" />
              </div>
            ) : historyEntries?.data && historyEntries.data.length > 0 ? (
              <div className="bg-white border border-brand-border rounded-lg overflow-hidden divide-y divide-brand-border">
                {historyEntries.data.map((entry) => (
                  <div key={entry.id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-headline font-bold uppercase text-[10px] px-1.5 py-0.5 bg-[#1A1A1A] text-white rounded">
                          {entry.action}
                        </span>
                        <span className="font-bold text-brand-text">{entry.item?.name}</span>
                        {entry.quantity && (
                          <span className="text-brand-muted">×{entry.quantity}</span>
                        )}
                      </div>
                      <p className="font-body text-[11px] text-brand-muted mt-1">
                        By {entry.user?.name || 'System'} ·{' '}
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-brand-border rounded-lg p-6 text-center">
                <p className="font-headline text-xs uppercase text-brand-muted">
                  No movement events logged yet.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: STORAGE LOCATIONS */}
        {activeTab === 'locations' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="font-headline font-bold text-sm uppercase text-brand-text">
                  Designated Storage Locations
                </h2>
                <p className="font-body text-xs text-brand-muted">
                  Lockers, bins, team trailers, and equipment sheds.
                </p>
              </div>
              {canManage && (
                <Button variant="urgent" size="sm" onClick={() => setShowAddLocation(true)}>
                  + New Location
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {locations?.map((loc) => (
                <div key={loc.id} className="bg-white border border-brand-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-headline font-bold text-sm uppercase text-brand-text truncate">
                      {loc.name}
                    </h3>
                  </div>
                  {loc.description && (
                    <p className="font-body text-xs text-brand-muted">{loc.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODAL: ADD ITEM */}
        {showAddItem && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-brand-border rounded-lg p-6 max-w-md w-full space-y-4">
              <h2 className="font-headline font-bold text-lg uppercase">Add Inventory Item</h2>
              <Input
                label="Item Name"
                required
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g. Match Soccer Ball"
              />
              <Input
                label="Category"
                value={newItemCategory}
                onChange={(e) => setNewItemCategory(e.target.value)}
                placeholder="e.g. BALLS, JERSEYS, MEDICAL"
              />
              <div>
                <label className="block text-[10px] font-headline font-bold uppercase tracking-widest text-brand-muted mb-1">
                  Tracking Model
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewItemTracking('BATCH')}
                    className={`py-2 text-xs font-headline font-bold uppercase border rounded ${
                      newItemTracking === 'BATCH'
                        ? 'border-primary bg-primary text-white'
                        : 'border-brand-border bg-white text-brand-text'
                    }`}
                  >
                    Batch / Bulk
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewItemTracking('ASSET')}
                    className={`py-2 text-xs font-headline font-bold uppercase border rounded ${
                      newItemTracking === 'ASSET'
                        ? 'border-primary bg-primary text-white'
                        : 'border-brand-border bg-white text-brand-text'
                    }`}
                  >
                    Individual Asset
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    label="Unit"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    placeholder="pcs, pairs, boxes"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    label="Minimum Stock Alert"
                    type="number"
                    min={0}
                    value={newItemMinQty}
                    onChange={(e) => setNewItemMinQty(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => setShowAddItem(false)}>
                  Cancel
                </Button>
                <Button
                  variant="urgent"
                  disabled={!newItemName.trim() || createItemMutation.isPending}
                  loading={createItemMutation.isPending}
                  onClick={() => createItemMutation.mutate()}
                >
                  Create Item
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD BATCH */}
        {batchItemId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-brand-border rounded-lg p-6 max-w-sm w-full space-y-4">
              <h2 className="font-headline font-bold text-base uppercase">Add Stock Batch</h2>
              <Input
                label="Quantity"
                type="number"
                min={1}
                value={batchQty}
                onChange={(e) => setBatchQty(Number(e.target.value))}
              />
              <Input
                label="Batch / Lot #"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="e.g. LOT-2026-A"
              />
              <div>
                <label className="block text-[10px] font-headline font-bold uppercase tracking-widest text-brand-muted mb-1">
                  Location
                </label>
                <select
                  value={batchLocationId}
                  onChange={(e) => setBatchLocationId(e.target.value)}
                  className="w-full border border-brand-border p-2 bg-white text-sm"
                >
                  <option value="">Unassigned</option>
                  {locations?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => setBatchItemId(null)}>
                  Cancel
                </Button>
                <Button
                  variant="urgent"
                  loading={createBatchMutation.isPending}
                  onClick={() => createBatchMutation.mutate(batchItemId)}
                >
                  Add Stock
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD ASSET */}
        {assetItemId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-brand-border rounded-lg p-6 max-w-sm w-full space-y-4">
              <h2 className="font-headline font-bold text-base uppercase">Register Asset Tag</h2>
              <Input
                label="Asset Tag / Barcode"
                value={assetTag}
                onChange={(e) => setAssetTag(e.target.value)}
                placeholder="e.g. GEAR-0042"
              />
              <Input
                label="Serial Number"
                value={assetSerial}
                onChange={(e) => setAssetSerial(e.target.value)}
                placeholder="Manufacturer serial #"
              />
              <div>
                <label className="block text-[10px] font-headline font-bold uppercase tracking-widest text-brand-muted mb-1">
                  Initial Location
                </label>
                <select
                  value={assetLocationId}
                  onChange={(e) => setAssetLocationId(e.target.value)}
                  className="w-full border border-brand-border p-2 bg-white text-sm"
                >
                  <option value="">Unassigned</option>
                  {locations?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => setAssetItemId(null)}>
                  Cancel
                </Button>
                <Button
                  variant="urgent"
                  loading={createAssetMutation.isPending}
                  onClick={() => createAssetMutation.mutate(assetItemId)}
                >
                  Register Asset
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: CHECKOUT */}
        {showCheckout && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-brand-border rounded-lg p-6 max-w-md w-full space-y-4">
              <h2 className="font-headline font-bold text-lg uppercase">Check Out Equipment</h2>
              <div>
                <label className="block text-[10px] font-headline font-bold uppercase tracking-widest text-brand-muted mb-1">
                  Select Item
                </label>
                <select
                  value={checkoutItemId}
                  onChange={(e) => {
                    setCheckoutItemId(e.target.value);
                    setCheckoutAssetId('');
                    setCheckoutBatchId('');
                  }}
                  className="w-full border border-brand-border p-2 bg-white text-sm"
                >
                  <option value="">Choose item...</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.availableQuantity ?? 0} available)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-headline font-bold uppercase tracking-widest text-brand-muted mb-1">
                  Borrower (Team Member)
                </label>
                <select
                  value={checkoutUserId}
                  onChange={(e) => setCheckoutUserId(e.target.value)}
                  className="w-full border border-brand-border p-2 bg-white text-sm"
                >
                  <option value="">Choose member...</option>
                  {members?.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user?.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    label="Quantity"
                    type="number"
                    min={1}
                    value={checkoutQty}
                    onChange={(e) => setCheckoutQty(Number(e.target.value))}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    label="Due in (Days)"
                    type="number"
                    min={1}
                    value={checkoutDueDays}
                    onChange={(e) => setCheckoutDueDays(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => setShowCheckout(false)}>
                  Cancel
                </Button>
                <Button
                  variant="urgent"
                  disabled={!checkoutItemId || !checkoutUserId || checkoutMutation.isPending}
                  loading={checkoutMutation.isPending}
                  onClick={() => checkoutMutation.mutate()}
                >
                  Confirm Check-Out
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: RETURN CUSTODY */}
        {returnCustodyId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-brand-border rounded-lg p-6 max-w-sm w-full space-y-4">
              <h2 className="font-headline font-bold text-base uppercase">Return Equipment</h2>
              <Input
                label="Quantity Returned"
                type="number"
                min={1}
                value={returnQty}
                onChange={(e) => setReturnQty(Number(e.target.value))}
              />
              <div>
                <label className="block text-[10px] font-headline font-bold uppercase tracking-widest text-brand-muted mb-1">
                  Item Condition Upon Return
                </label>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value as AssetCondition)}
                  className="w-full border border-brand-border p-2 bg-white text-sm"
                >
                  <option value="EXCELLENT">Excellent</option>
                  <option value="GOOD">Good</option>
                  <option value="FAIR">Fair (Normal Wear)</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="LOST">Lost / Missing</option>
                </select>
              </div>
              <Input
                label="Return Notes (Optional)"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="Condition notes, cleaned, etc."
              />
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => setReturnCustodyId(null)}>
                  Cancel
                </Button>
                <Button
                  variant="urgent"
                  loading={returnMutation.isPending}
                  onClick={() => returnMutation.mutate(returnCustodyId)}
                >
                  Complete Return
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: DAMAGE REPORT */}
        {showDamageReport && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-brand-border rounded-lg p-6 max-w-md w-full space-y-4">
              <h2 className="font-headline font-bold text-lg uppercase">
                Report Condition / Damage
              </h2>
              <div>
                <label className="block text-[10px] font-headline font-bold uppercase tracking-widest text-brand-muted mb-1">
                  Item
                </label>
                <select
                  value={damageItemId}
                  onChange={(e) => setDamageItemId(e.target.value)}
                  className="w-full border border-brand-border p-2 bg-white text-sm"
                >
                  <option value="">Select item...</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Asset Tag (Optional)"
                value={damageAssetId}
                onChange={(e) => setDamageAssetId(e.target.value)}
                placeholder="Specific asset tag if applicable"
              />
              <div>
                <label className="block text-[10px] font-headline font-bold uppercase tracking-widest text-brand-muted mb-1">
                  Observed Condition
                </label>
                <select
                  value={damageCondition}
                  onChange={(e) => setDamageCondition(e.target.value as AssetCondition)}
                  className="w-full border border-brand-border p-2 bg-white text-sm"
                >
                  <option value="DAMAGED">Damaged / Needs Repair</option>
                  <option value="FAIR">Fair / Heavily Worn</option>
                  <option value="LOST">Lost</option>
                  <option value="GOOD">Good</option>
                </select>
              </div>
              <Input
                label="Description of Damage / Incident"
                required
                value={damageNotes}
                onChange={(e) => setDamageNotes(e.target.value)}
                placeholder="Describe tear, broken seam, missing zipper..."
              />
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => setShowDamageReport(false)}>
                  Cancel
                </Button>
                <Button
                  variant="urgent"
                  disabled={!damageItemId || !damageNotes.trim() || conditionMutation.isPending}
                  loading={conditionMutation.isPending}
                  onClick={() => conditionMutation.mutate()}
                >
                  Submit Report
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: ADD LOCATION */}
        {showAddLocation && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-brand-border rounded-lg p-6 max-w-sm w-full space-y-4">
              <h2 className="font-headline font-bold text-base uppercase">Add Storage Location</h2>
              <Input
                label="Location Name"
                required
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                placeholder="e.g. Locker 4B, Team Shed"
              />
              <Input
                label="Description (Optional)"
                value={newLocationDesc}
                onChange={(e) => setNewLocationDesc(e.target.value)}
                placeholder="Shelf number, access code..."
              />
              <div className="flex gap-2 justify-end pt-2">
                <Button variant="ghost" onClick={() => setShowAddLocation(false)}>
                  Cancel
                </Button>
                <Button
                  variant="urgent"
                  disabled={!newLocationName.trim() || createLocationMutation.isPending}
                  loading={createLocationMutation.isPending}
                  onClick={() => createLocationMutation.mutate()}
                >
                  Save Location
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: QR CODE DISPLAY */}
        {generatedQr && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-brand-border rounded-lg p-6 max-w-sm w-full space-y-4 text-center">
              <h2 className="font-headline font-bold text-base uppercase">Printable QR Code</h2>
              <div className="bg-white p-4 border border-brand-border inline-block mx-auto rounded">
                {generatedQr.qrDataUrl ? (
                  <img
                    src={generatedQr.qrDataUrl}
                    alt="Inventory QR Code"
                    className="w-48 h-48 mx-auto object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 bg-[#1A1A1A] p-2 flex items-center justify-center text-white font-headline text-[10px] break-all">
                    <div className="bg-white p-2 text-black w-full h-full flex flex-col items-center justify-center">
                      <span className="font-bold font-headline text-xs mb-1">PACKPLAY QR</span>
                      <span className="text-[8px] font-mono">{generatedQr.token || 'READY'}</span>
                    </div>
                  </div>
                )}
              </div>
              <p className="font-mono text-xs text-brand-muted break-all">{generatedQr.qrUrl}</p>
              <div className="flex gap-2 justify-center pt-2">
                <Button variant="urgent" size="sm" onClick={() => window.print()}>
                  Print
                </Button>
                {generatedQr.token && (
                  <Link
                    to={`/inventory/scan/${generatedQr.token}`}
                    className="px-3 py-1.5 bg-primary text-white font-headline font-bold text-xs uppercase rounded flex items-center"
                  >
                    Open Lookup
                  </Link>
                )}
                <Button variant="ghost" size="sm" onClick={() => setGeneratedQr(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
