import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { ActivityType, PersonalChecklist, SportProfile } from '@/types';

const ACTIVITY_TYPES: ActivityType[] = ['TRAINING', 'COMPETITION', 'CASUAL', 'TRAVEL'];

export function ChecklistsPage() {
  const queryClient = useQueryClient();
  const [profileName, setProfileName] = useState('');
  const [profileTypes, setProfileTypes] = useState<ActivityType[]>(['TRAINING']);
  const [checklistName, setChecklistName] = useState('');
  const [profileId, setProfileId] = useState('');
  const [activityType, setActivityType] = useState<ActivityType>('TRAINING');

  const profiles = useQuery<SportProfile[]>({ queryKey: ['sport-profiles'], queryFn: () => api.get('/sport-profiles').then((r) => r.data) });
  const checklists = useQuery<PersonalChecklist[]>({ queryKey: ['checklists'], queryFn: () => api.get('/checklists').then((r) => r.data) });

  const createProfile = useMutation({
    mutationFn: () => api.post('/sport-profiles', { name: profileName, activityTypes: profileTypes }),
    onSuccess: (response) => {
      setProfileName('');
      setProfileId(response.data.id);
      queryClient.invalidateQueries({ queryKey: ['sport-profiles'] });
    },
  });

  const createChecklist = useMutation({
    mutationFn: () => api.post('/checklists', { name: checklistName, sportProfileId: profileId, activityType }),
    onSuccess: () => {
      setChecklistName('');
      queryClient.invalidateQueries({ queryKey: ['checklists'] });
    },
  });

  const submitProfile = (event: FormEvent) => { event.preventDefault(); createProfile.mutate(); };
  const submitChecklist = (event: FormEvent) => { event.preventDefault(); createChecklist.mutate(); };
  const isLoading = profiles.isLoading || checklists.isLoading;

  return (
    <PageLayout>
      <div className="py-6 space-y-8">
        <header><h1 className="font-headline text-2xl font-bold uppercase">Personal checklists</h1><p className="text-sm text-brand-muted">Organize reusable gear lists by sport and activity.</p></header>

        <section className="border border-brand-border bg-white p-4">
          <h2 className="font-headline font-bold uppercase mb-4">Create sport profile</h2>
          <form onSubmit={submitProfile} className="space-y-4">
            <Input label="Sport name" required minLength={2} value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            <fieldset><legend className="font-headline text-xs uppercase mb-2">Activity types</legend><div className="grid grid-cols-2 gap-2">{ACTIVITY_TYPES.map((type) => <label key={type} className="flex gap-2 text-sm"><input type="checkbox" checked={profileTypes.includes(type)} onChange={() => setProfileTypes((current) => current.includes(type) ? current.filter((value) => value !== type) : [...current, type])} />{type}</label>)}</div></fieldset>
            <Button type="submit" loading={createProfile.isPending} disabled={profileTypes.length === 0}>Create profile</Button>
          </form>
        </section>

        <section className="border border-brand-border bg-white p-4">
          <h2 className="font-headline font-bold uppercase mb-4">Create checklist</h2>
          <form onSubmit={submitChecklist} className="space-y-4">
            <Input label="Checklist name" required minLength={2} value={checklistName} onChange={(e) => setChecklistName(e.target.value)} />
            <label className="block text-xs uppercase font-headline">Sport profile<select required className="mt-1 w-full border border-brand-border p-2 bg-white" value={profileId} onChange={(e) => setProfileId(e.target.value)}><option value="">Choose a profile</option>{profiles.data?.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
            <label className="block text-xs uppercase font-headline">Activity type<select className="mt-1 w-full border border-brand-border p-2 bg-white" value={activityType} onChange={(e) => setActivityType(e.target.value as ActivityType)}>{ACTIVITY_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
            <Button type="submit" loading={createChecklist.isPending} disabled={!profileId}>Create checklist</Button>
          </form>
        </section>

        <section><h2 className="font-headline font-bold uppercase mb-3">Your lists</h2>{isLoading ? <LoadingSpinner /> : <div className="space-y-3">{checklists.data?.map((checklist) => <Link key={checklist.id} to={`/checklists/${checklist.id}`} className="block border border-brand-border bg-white p-4"><div className="flex justify-between"><strong className="font-headline uppercase">{checklist.name}</strong>{checklist.isTemplate && <span className="text-xs text-success">TEMPLATE</span>}</div><p className="text-xs text-brand-muted mt-1">{checklist.activityType ?? 'ANY ACTIVITY'} · {checklist._count?.items ?? 0} items</p></Link>)}{checklists.data?.length === 0 && <p className="text-sm text-brand-muted">No personal checklists yet.</p>}</div>}</section>
      </div>
    </PageLayout>
  );
}
