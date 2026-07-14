import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { EquipmentItem, PersonalChecklist } from '@/types';

type ItemDraft = Pick<EquipmentItem, 'name' | 'quantity' | 'isMandatory'> & { category: string; notes: string };
const EMPTY_ITEM: ItemDraft = { name: '', quantity: 1, category: '', isMandatory: false, notes: '' };

export function ChecklistDetailPage() {
  const { checklistId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_ITEM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const checklist = useQuery<PersonalChecklist>({ queryKey: ['checklist', checklistId], queryFn: () => api.get(`/checklists/${checklistId}`).then((r) => r.data), enabled: !!checklistId });
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['checklist', checklistId] }); queryClient.invalidateQueries({ queryKey: ['checklists'] }); };
  const saveItem = useMutation({ mutationFn: () => editingId ? api.patch(`/checklists/${checklistId}/items/${editingId}`, draft) : api.post(`/checklists/${checklistId}/items`, draft), onSuccess: () => { setDraft(EMPTY_ITEM); setEditingId(null); refresh(); } });
  const deleteItem = useMutation({ mutationFn: (itemId: string) => api.delete(`/checklists/${checklistId}/items/${itemId}`), onSuccess: refresh });
  const template = useMutation({ mutationFn: () => api.post(`/checklists/${checklistId}/save-as-template`), onSuccess: refresh });
  const duplicate = useMutation({ mutationFn: () => api.post(`/checklists/${checklistId}/duplicate`), onSuccess: (response) => { refresh(); navigate(`/checklists/${response.data.id}`); } });
  const removeChecklist = useMutation({ mutationFn: () => api.delete(`/checklists/${checklistId}`), onSuccess: () => navigate('/checklists') });
  const submit = (event: FormEvent) => { event.preventDefault(); saveItem.mutate(); };
  const startEditing = (item: EquipmentItem) => { setEditingId(item.id); setDraft({ name: item.name, quantity: item.quantity, category: item.category ?? '', isMandatory: item.isMandatory, notes: item.notes ?? '' }); };

  if (checklist.isLoading) return <PageLayout><div className="py-16"><LoadingSpinner /></div></PageLayout>;
  if (!checklist.data) return <PageLayout><p className="py-16">Checklist not found.</p></PageLayout>;

  return (
    <PageLayout><div className="py-6 space-y-6">
      <header><button onClick={() => navigate('/checklists')} className="text-xs uppercase underline">Back</button><h1 className="font-headline text-2xl font-bold uppercase mt-3">{checklist.data.name}</h1><p className="text-sm text-brand-muted">{checklist.data.activityType ?? 'Any activity'}</p></header>
      <div className="grid grid-cols-2 gap-2"><Button variant="ghost" onClick={() => template.mutate()} disabled={checklist.data.isTemplate}>{checklist.data.isTemplate ? 'Saved template' : 'Save as template'}</Button><Button variant="ghost" onClick={() => duplicate.mutate()} loading={duplicate.isPending}>Duplicate</Button></div>
      <section className="border border-brand-border bg-white p-4"><h2 className="font-headline font-bold uppercase mb-4">{editingId ? 'Edit item' : 'Add custom item'}</h2><form onSubmit={submit} className="space-y-4"><Input label="Item name" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /><Input label="Quantity" type="number" min={1} required value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: Number(e.target.value) })} /><Input label="Category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /><Input label="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /><label className="flex gap-2 text-sm"><input type="checkbox" checked={draft.isMandatory} onChange={(e) => setDraft({ ...draft, isMandatory: e.target.checked })} />Mandatory item</label><div className="flex gap-2"><Button type="submit" loading={saveItem.isPending}>{editingId ? 'Save changes' : 'Add item'}</Button>{editingId && <Button type="button" variant="ghost" onClick={() => { setEditingId(null); setDraft(EMPTY_ITEM); }}>Cancel</Button>}</div></form></section>
      <section><h2 className="font-headline font-bold uppercase mb-3">Equipment</h2><div className="space-y-3">{checklist.data.items?.map((item) => <article key={item.id} className="border border-brand-border bg-white p-4"><div className="flex justify-between gap-3"><div><strong>{item.quantity}× {item.name}</strong><p className="text-xs text-brand-muted">{item.category || 'Uncategorized'}{item.isMandatory ? ' · MANDATORY' : ''}</p>{item.notes && <p className="text-sm mt-1">{item.notes}</p>}</div><div className="flex flex-col gap-2"><button onClick={() => startEditing(item)} className="text-xs uppercase underline">Edit</button><button onClick={() => deleteItem.mutate(item.id)} className="text-xs uppercase text-error underline">Remove</button></div></div></article>)}{checklist.data.items?.length === 0 && <p className="text-sm text-brand-muted">No items yet.</p>}</div></section>
      <Button variant="ghost" fullWidth onClick={() => { if (window.confirm('Delete this checklist and all its items?')) removeChecklist.mutate(); }} className="text-error">Delete checklist</Button>
    </div></PageLayout>
  );
}
