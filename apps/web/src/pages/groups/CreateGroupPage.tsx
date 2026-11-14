import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Trophy, Plane, Activity as ActivityIcon, CheckCircle2, ShieldCheck, Sparkles, Plus, ArrowLeft, ArrowRight } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { PageLayout } from '@/components/layout/PageLayout';
import { groupsService } from '@/services/groups.service';
import { equipmentService } from '@/services/equipment.service';

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

type ActivityKind = 'TRAINING' | 'COMPETITION' | 'CASUAL';

interface ItemEntry {
  localId: string;
  name: string;
  description: string;
  quantity: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ACTIVITY_OPTIONS: { value: ActivityKind; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'COMPETITION', label: 'TOURNAMENT', Icon: Trophy },
  { value: 'CASUAL',      label: 'AWAY GAME',  Icon: Plane },
  { value: 'TRAINING',    label: 'PRACTICE',   Icon: ActivityIcon },
];

const PRESET_GEAR: { name: string; description: string; quantity: number }[] = [
  { name: 'MATCH BALLS', description: 'Official size game balls', quantity: 2 },
  { name: 'FIRST AID KIT', description: 'Medical tape, cold packs, bandages', quantity: 1 },
  { name: 'TRAINING CONES', description: 'Agility marker set', quantity: 10 },
  { name: 'TEAM WATER BOTTLES', description: 'Hydration squad pack', quantity: 8 },
];

// ─── Shared style atoms ───────────────────────────────────────────────────────

const labelCaps = 'font-headline text-xs uppercase tracking-widest text-brand-text';
const inputBase =
  'w-full border border-brand-border px-3 py-2 bg-white font-body text-brand-text rounded-none focus:outline-none focus:border-2 focus:border-brand-border placeholder:text-brand-muted text-sm';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepTracker({ currentStep }: { currentStep: Step }) {
  const steps = [
    { num: 1, label: 'MISSION DETAILS' },
    { num: 2, label: 'ITEM MANIFEST' },
    { num: 3, label: 'ACCESS PASS' },
  ];

  return (
    <div className="flex items-center justify-between mb-4 md:mb-6 px-1">
      {steps.map((s, idx) => {
        const isDone = s.num < currentStep;
        const isCurrent = s.num === currentStep;
        return (
          <div key={s.num} className="flex items-center flex-1 last:flex-initial">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center font-headline font-bold text-xs transition-colors ${
                  isDone
                    ? 'bg-[#2D6A4F] text-white'
                    : isCurrent
                    ? 'bg-[#FF4D00] text-white'
                    : 'bg-white border-2 border-brand-border text-brand-muted'
                }`}
              >
                {isDone ? '✓' : s.num}
              </div>
              <span
                className={`font-headline text-[11px] uppercase tracking-wider font-bold hidden sm:inline ${
                  isCurrent ? 'text-[#FF4D00]' : isDone ? 'text-[#2D6A4F]' : 'text-brand-muted'
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 md:mx-4 transition-colors ${
                  isDone ? 'bg-[#2D6A4F]' : 'bg-brand-border/60'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepHeader({
  left,
  title,
  sub,
}: {
  left: React.ReactNode;
  title: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="bg-[#1A1A1A] text-white px-4 md:px-6 py-3.5 flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <div className="w-20">{left}</div>
        <h2 className="font-headline font-bold text-sm md:text-base uppercase tracking-widest text-center flex-1">
          {title}
        </h2>
        <div className="w-20 flex justify-end opacity-0 select-none pointer-events-none">{left}</div>
      </div>
      {sub && <div className="text-center">{sub}</div>}
    </div>
  );
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

function Step1({
  onSuccess,
}: {
  onSuccess: (groupId: string, activityId: string, name: string) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName]               = useState('');
  const [nameError, setNameError]     = useState('');
  const [activityType, setActivityType] = useState<ActivityKind>('COMPETITION');
  const [typeError, setTypeError]     = useState('');
  const [notes, setNotes]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [serverError, setServerError] = useState('');

  const handleContinue = async () => {
    setNameError('');
    setTypeError('');
    setServerError('');

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError('Mission name must be at least 2 characters.');
      return;
    }

    setLoading(true);
    try {
      // 1. Create group
      const group = await groupsService.createGroup({
        name: trimmed,
        sport: activityType,
        description: notes.trim() || undefined,
      });

      // 2. Create activity
      const activity = await groupsService.createActivity(group.id, {
        name: 'Mission Activity',
        activityType,
      });

      queryClient.invalidateQueries({ queryKey: ['groups'] });
      onSuccess(group.id, activity.id, trimmed);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create mission. Please try again.';
      setServerError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Form Column */}
      <div className="lg:col-span-7 flex flex-col bg-white border border-brand-border rounded-lg shadow-sm overflow-hidden">
        <StepHeader
          left={
            <button
              onClick={() => navigate(-1)}
              className="font-headline font-bold text-white hover:opacity-70 transition-opacity text-xs md:text-sm"
              aria-label="Go back"
            >
              <span className="inline-flex items-center gap-1.5"><ArrowLeft className="w-3.5 h-3.5" /> BACK</span>
            </button>
          }
          title="NEW MISSION"
          sub={
            <p className="font-headline text-xs tracking-widest text-[#FF4D00]">
              LOGISTICS ID: #PP-MISSION
            </p>
          }
        />

        <div className="flex-1 px-4 py-6 md:px-8 md:py-8 flex flex-col gap-6">
          {serverError && (
            <div className="border border-error bg-white px-4 py-3">
              <p className="font-body text-sm text-error">{serverError}</p>
            </div>
          )}

          {/* Mission Name */}
          <div>
            <label className={`${labelCaps} block mb-1`} htmlFor="mission-name">
              MISSION NAME
            </label>
            <input
              id="mission-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter mission name (e.g. Thunder FC Season)..."
              className={inputBase}
            />
            {nameError ? (
              <p className="font-body text-xs text-error mt-1">{nameError}</p>
            ) : (
              <p className="font-body text-xs text-brand-muted mt-1">
                Appears on all equipment tags and manifest lists
              </p>
            )}
          </div>

          {/* Activity Type */}
          <div>
            <p className={`${labelCaps} mb-2`}>ACTIVITY TYPE</p>
            {typeError && (
              <p className="font-body text-xs text-error mb-1">{typeError}</p>
            )}
            <div className="grid grid-cols-3 gap-3">
              {ACTIVITY_OPTIONS.map((opt) => {
                const selected = activityType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setActivityType(opt.value)}
                    className={[
                      'flex flex-col items-center justify-center gap-1.5 py-4 px-2 border rounded transition-all duration-200',
                      selected
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-white text-brand-text border-brand-border hover:border-primary/60 hover:bg-black/5',
                    ].join(' ')}
                  >
                    <opt.Icon className={`w-6 h-6 mb-0.5 ${selected ? 'text-white' : 'text-primary'}`} />
                    <span className="font-headline font-bold text-xs uppercase tracking-wider leading-tight text-center">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="briefing-notes" className={`${labelCaps} block mb-1`}>
              BRIEFING / NOTES
            </label>
            <textarea
              id="briefing-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional mission briefing..."
              rows={4}
              className={`${inputBase} resize-none`}
            />
            <p className="font-body text-xs text-brand-muted mt-1">
              Optional. Shared with all team members.
            </p>
          </div>
        </div>

        {/* Action bottom */}
        <div className="px-4 py-4 md:px-8 md:py-6 bg-[#FCF9F8] border-t border-brand-border">
          <button
            type="button"
            onClick={handleContinue}
            disabled={loading}
            className="w-full min-h-[48px] bg-primary text-white font-headline font-bold text-sm uppercase tracking-widest flex items-center justify-center disabled:opacity-60 transition-opacity rounded-sm hover:brightness-105 active:scale-[0.99]"
          >
            {loading ? 'CREATING...' : 'CONTINUE →'}
          </button>
          <p className="font-body text-xs text-brand-muted text-center mt-2 leading-relaxed">
            All group members will receive a notification to verify their equipment gear manifest once created.
          </p>
        </div>
      </div>

      {/* Desktop Column: Live Preview & Mission Protocol */}
      <div className="hidden lg:flex lg:col-span-5 flex-col gap-5">
        {/* Real-time Live Squad Card Preview */}
        <div className="bg-white border-2 border-brand-border rounded-lg p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="font-headline text-[10px] uppercase tracking-widest text-[#FF4D00] font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FF4D00]" /> SQUAD PREVIEW
            </span>
            <span className="font-headline text-[10px] uppercase tracking-wider border border-brand-border px-2 py-0.5 text-brand-text">
              1 MEMBER (YOU)
            </span>
          </div>

          <h3 className="font-headline font-bold text-xl uppercase tracking-wide text-brand-text truncate">
            {name.trim() || 'UNTITLED SQUAD'}
          </h3>
          <p className="font-headline text-xs uppercase tracking-widest text-brand-muted mt-0.5">
            {ACTIVITY_OPTIONS.find((a) => a.value === activityType)?.label || 'MISSION'}
          </p>

          {notes.trim() && (
            <p className="font-body text-xs text-brand-muted mt-3 bg-[#FCF9F8] p-3 rounded border border-brand-border/40">
              {notes.trim()}
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-brand-border/40 flex items-center justify-between">
            <span className="font-headline text-[10px] uppercase tracking-widest text-brand-muted">
              GEAR READINESS
            </span>
            <span className="font-headline font-bold text-xs uppercase tracking-wider text-[#FF4D00]">
              STEP 2 CONFIGURES MANIFEST
            </span>
          </div>
        </div>

        {/* Mission Setup Guidelines */}
        <div className="bg-[#1A1A1A] text-white rounded-lg p-5 shadow-sm border border-brand-border">
          <p className="font-headline font-bold text-xs uppercase tracking-widest text-[#FF4D00] mb-3 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#FF4D00]" /> READINESS SETUP PROTOCOL
          </p>
          <ul className="space-y-3 font-body text-xs text-white/80">
            <li className="flex items-start gap-2.5">
              <span className="font-headline font-bold text-xs text-[#FF4D00]">01.</span>
              <span><strong>Squad Identity:</strong> Establish event schedule, sport profile, and team name.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="font-headline font-bold text-xs text-[#FF4D00]">02.</span>
              <span><strong>Manifest Itemization:</strong> Assign communal equipment (balls, first aid, training cones).</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="font-headline font-bold text-xs text-[#FF4D00]">03.</span>
              <span><strong>Varsity Access Pass:</strong> Squad members join via instant QR code and claim gear custody.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

function Step2({
  groupId,
  activityId,
  onBack,
  onSuccess,
}: {
  groupId: string;
  activityId: string;
  onBack: () => void;
  onSuccess: (token: string) => void;
}) {
  const [items, setItems]               = useState<ItemEntry[]>([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName]     = useState('');
  const [customDesc, setCustomDesc]     = useState('');
  const [customQty, setCustomQty]       = useState(1);
  const [finishing, setFinishing]       = useState(false);
  const [serverError, setServerError]   = useState('');

  const updateQuantity = useCallback((localId: string, delta: number) => {
    setItems((prev) => {
      const target = prev.find((it) => it.localId === localId);
      if (!target) return prev;
      const newQty = target.quantity + delta;
      if (newQty <= 0) return prev.filter((it) => it.localId !== localId);
      return prev.map((it) => (it.localId === localId ? { ...it, quantity: newQty } : it));
    });
  }, []);

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    const newItem: ItemEntry = {
      localId: `item-${Date.now()}`,
      name: customName.trim().toUpperCase(),
      description: customDesc.trim(),
      quantity: customQty,
    };
    setItems((prev) => [...prev, newItem]);
    setCustomName('');
    setCustomDesc('');
    setCustomQty(1);
    setShowCustomForm(false);
  };

  const handleAddPreset = (preset: { name: string; description: string; quantity: number }) => {
    setItems((prev) => {
      const existing = prev.find((it) => it.name.toUpperCase() === preset.name.toUpperCase());
      if (existing) {
        return prev.map((it) =>
          it.localId === existing.localId ? { ...it, quantity: it.quantity + preset.quantity } : it
        );
      }
      return [
        ...prev,
        {
          localId: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: preset.name,
          description: preset.description,
          quantity: preset.quantity,
        },
      ];
    });
  };

  const handleFinish = async () => {
    setServerError('');
    setFinishing(true);
    try {
      if (items.length > 0) {
        await Promise.all(
          items.map((item) =>
            equipmentService.addSharedItem(activityId, {
              name: item.name,
              notes: item.description || undefined,
              requiredQuantity: item.quantity,
            }),
          ),
        );
      }

      const invitation = await groupsService.createInvitation(groupId, {
        expiresInHours: 168,
        maxUses: 50,
      });
      onSuccess(invitation.token);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create mission. Please try again.';
      setServerError(msg);
    } finally {
      setFinishing(false);
    }
  };

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Manifest Editor Column */}
      <div className="lg:col-span-7 flex flex-col bg-white border border-brand-border rounded-lg shadow-sm overflow-hidden">
        <StepHeader
          left={
            <button
              onClick={onBack}
              className="font-headline font-bold text-white hover:opacity-70 transition-opacity text-xs md:text-sm"
              aria-label="Back to step 1"
            >
              <span className="inline-flex items-center gap-1.5"><ArrowLeft className="w-3.5 h-3.5" /> STEP 1</span>
            </button>
          }
          title="ITEM MANIFEST"
          sub={
            <div className="flex justify-center gap-4">
              <span className="font-headline text-xs tracking-widest text-[#FF4D00]">
                MISSION ID: #{groupId.slice(0, 8).toUpperCase()}
              </span>
            </div>
          }
        />

        <div className="flex-1 px-4 py-4 md:px-8 md:py-6 flex flex-col gap-0">
          {serverError && (
            <div className="border border-error bg-white px-4 py-3 mb-3">
              <p className="font-body text-sm text-error">{serverError}</p>
            </div>
          )}

          {/* Item list */}
          <div className="border border-brand-border bg-white rounded-sm overflow-hidden">
            {items.length === 0 && !showCustomForm && (
              <div className="px-4 py-8 text-center">
                <p className="font-headline text-xs uppercase tracking-widest text-brand-muted">
                  NO ITEMS YET
                </p>
                <p className="font-body text-xs text-brand-muted mt-1">
                  Add equipment and gear your team needs to bring.
                </p>
              </div>
            )}
            {items.map((item, idx) => (
              <div
                key={item.localId}
                className="flex items-stretch border-b border-brand-border last:border-b-0 hover:bg-black/[0.02] transition-colors"
              >
                {/* Left: info */}
                <div className="flex-1 px-4 py-3">
                  <p className="font-headline text-xs text-brand-muted tracking-widest">
                    #{String(idx + 1).padStart(3, '0')}
                  </p>
                  <p className="font-headline font-bold text-sm uppercase text-brand-text mt-0.5">
                    {item.name}
                  </p>
                  {item.description && (
                    <p className="font-body text-xs text-brand-muted mt-0.5">{item.description}</p>
                  )}
                </div>

                {/* Right: qty controls */}
                <div className="flex flex-col items-center justify-center px-4 py-3 gap-1 border-l border-brand-border min-w-[80px]">
                  <span className="font-headline font-bold text-3xl md:text-4xl text-brand-text leading-none">
                    {item.quantity}
                  </span>
                  <div className="flex gap-1 mt-1">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.localId, -1)}
                      aria-label={`Decrease ${item.name}`}
                      className="w-8 h-8 border border-brand-border font-headline font-bold text-lg flex items-center justify-center hover:bg-brand-bg transition-colors active:scale-95"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.localId, 1)}
                      aria-label={`Increase ${item.name}`}
                      className="w-8 h-8 border border-brand-border font-headline font-bold text-lg flex items-center justify-center hover:bg-brand-bg transition-colors active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Custom item form inline */}
            {showCustomForm && (
              <div className="border-b border-brand-border last:border-b-0 px-4 py-4 bg-[#FCF9F8] flex flex-col gap-2.5">
                <p className={`${labelCaps} text-[10px]`}>NEW ITEM</p>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Item name (e.g. First Aid Kit, Match Ball)..."
                  className={`${inputBase} text-xs py-2`}
                />
                <input
                  type="text"
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder="Description / Specs (optional)..."
                  className={`${inputBase} text-xs py-2`}
                />
                <div className="flex items-center gap-2 pt-1">
                  <span className="font-body text-xs text-brand-muted">QTY:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCustomQty((q) => Math.max(1, q - 1))}
                      className="w-8 h-8 border border-brand-border font-headline font-bold text-lg flex items-center justify-center bg-white"
                    >
                      −
                    </button>
                    <span className="font-headline font-bold text-base w-8 text-center">
                      {customQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomQty((q) => q + 1)}
                      className="w-8 h-8 border border-brand-border font-headline font-bold text-lg flex items-center justify-center bg-white"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustom}
                    disabled={!customName.trim()}
                    className="ml-auto bg-primary text-white font-headline font-bold text-xs uppercase tracking-widest px-4 h-8 disabled:opacity-60 hover:brightness-105 active:scale-95 transition-all"
                  >
                    ADD
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomForm(false)}
                    className="font-headline text-xs text-brand-muted uppercase tracking-widest px-2 h-8 hover:text-brand-text transition-colors"
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Request custom item button */}
          {!showCustomForm && (
            <button
              type="button"
              onClick={() => setShowCustomForm(true)}
              className="w-full mt-3 min-h-[48px] border border-dashed border-brand-border bg-white font-headline font-bold text-xs uppercase tracking-widest text-brand-text flex items-center justify-center gap-2 hover:bg-brand-bg hover:border-primary/60 transition-colors"
            >
              + ADD GEAR ITEM
            </button>
          )}
        </div>

        {/* Action bottom */}
        <div className="px-4 py-4 md:px-8 md:py-6 bg-[#FCF9F8] border-t border-brand-border">
          <button
            type="button"
            onClick={handleFinish}
            disabled={finishing}
            className="w-full min-h-[48px] bg-primary text-white font-headline font-bold text-sm uppercase tracking-widest flex items-center justify-center disabled:opacity-60 transition-opacity rounded-sm hover:brightness-105 active:scale-[0.99]"
          >
            {finishing ? 'GENERATING...' : (
              <span className="inline-flex items-center justify-center gap-1.5">
                FINISH &amp; INVITE <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Desktop Column: Manifest Summary & Recommended Presets */}
      <div className="hidden lg:flex lg:col-span-5 flex-col gap-5">
        {/* Manifest Stats Card */}
        <div className="bg-white border-2 border-brand-border rounded-lg p-5 shadow-sm">
          <p className="font-headline font-bold text-xs uppercase tracking-widest text-[#FF4D00] mb-3">
            MANIFEST SUMMARY
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#FCF9F8] border border-brand-border/40 p-3 rounded">
              <span className="font-headline text-[10px] uppercase tracking-widest text-brand-muted block">
                TOTAL ITEMS
              </span>
              <span className="font-headline font-bold text-2xl text-brand-text mt-1 block">
                {items.length}
              </span>
            </div>
            <div className="bg-[#FCF9F8] border border-brand-border/40 p-3 rounded">
              <span className="font-headline text-[10px] uppercase tracking-widest text-brand-muted block">
                TOTAL PIECES
              </span>
              <span className="font-headline font-bold text-2xl text-[#FF4D00] mt-1 block">
                {totalQuantity}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Add Presets Card */}
        <div className="bg-white border border-brand-border rounded-lg p-5 shadow-sm">
          <p className="font-headline font-bold text-xs uppercase tracking-widest text-brand-text mb-2">
            ESSENTIAL SQUAD PRESETS
          </p>
          <p className="font-body text-xs text-brand-muted mb-3">
            Quick-add standard athletic equipment packs to this mission manifest:
          </p>
          <div className="flex flex-col gap-2">
            {PRESET_GEAR.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleAddPreset(preset)}
                className="flex items-center justify-between p-2.5 border border-brand-border/60 rounded hover:border-primary hover:bg-[#FF4D00]/5 transition-all text-left group"
              >
                <div>
                  <span className="font-headline font-bold text-xs uppercase tracking-wider text-brand-text group-hover:text-[#FF4D00] block">
                    {preset.name}
                  </span>
                  <span className="font-body text-[11px] text-brand-muted block">
                    {preset.description}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 font-headline font-bold text-xs text-[#FF4D00] border border-[#FF4D00] px-2 py-0.5 rounded">
                  <Plus className="w-3 h-3" /> QTY {preset.quantity}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3 ───────────────────────────────────────────────────────────────────

function Step3({
  groupId,
  groupName,
  inviteToken,
  onBack,
}: {
  groupId: string;
  groupName: string;
  inviteToken: string;
  onBack: () => void;
}) {
  const navigate  = useNavigate();
  const [copied, setCopied] = useState(false);

  const inviteLink = `${window.location.origin}/join/${inviteToken}`;

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink).catch(() => {
      const el = document.createElement('textarea');
      el.value = inviteLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({ title: `Join my PackPlay squad: ${groupName}`, url: inviteLink })
        .catch(() => {});
    } else {
      copyLink();
    }
  };

  const tokenShort = inviteToken.slice(0, 8).toUpperCase();
  const tokenPreview = inviteToken.slice(0, 12);

  return (
    <div className="flex flex-col bg-white border border-brand-border rounded-lg shadow-sm overflow-hidden">
      <StepHeader
        left={
          <button
            onClick={onBack}
            className="font-headline font-bold text-white hover:opacity-70 transition-opacity text-xs md:text-sm"
            aria-label="Back to item manifest"
          >
            <span className="inline-flex items-center gap-1.5"><ArrowLeft className="w-3.5 h-3.5" /> BACK</span>
          </button>
        }
        title="JOIN MISSION"
      />

      <div className="flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-4xl mx-auto">
          {/* Left Column: Varsity Access Pass Card */}
          <div className="lg:col-span-6 w-full">
            <div className="border-2 border-brand-border bg-white rounded-lg overflow-hidden shadow-md">
              {/* Card header strip */}
              <div className="bg-[#1A1A1A] px-4 py-3.5">
                <p className="font-headline font-bold text-xs uppercase tracking-widest text-[#FF4D00]">
                  VARSITY ACCESS PASS
                </p>
                <p className="font-headline font-bold text-lg uppercase text-white mt-0.5 truncate">
                  {groupName}
                </p>
              </div>

              {/* QR code */}
              <div className="flex justify-center py-6 bg-white">
                <QRCodeSVG
                  value={inviteLink}
                  size={190}
                  bgColor="#FFFFFF"
                  fgColor="#1A1A1A"
                  level="M"
                />
              </div>

              {/* Divider */}
              <div className="border-t border-brand-border mx-4" />

              {/* Pass details */}
              <div className="px-4 py-3.5 flex flex-col gap-1.5 bg-[#FCF9F8]">
                <p className="font-headline text-xs uppercase tracking-widest text-brand-text">
                  SERIAL: #{tokenShort}
                </p>
                <p className="font-headline text-xs uppercase tracking-widest text-brand-text">
                  EXPIRES: 7 DAYS
                </p>
                <p className="font-body text-xs text-brand-muted truncate mt-0.5">
                  {window.location.host}/join/{tokenPreview}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Dispatch Actions & Info */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div>
              <span className="font-headline font-bold text-xs uppercase tracking-widest text-[#2D6A4F] flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-4 h-4 text-[#2D6A4F]" /> MISSION INITIALIZED
              </span>
              <h3 className="font-headline font-bold text-2xl uppercase tracking-wide text-brand-text">
                INVITE YOUR SQUAD
              </h3>
              <p className="font-body text-sm text-brand-muted mt-2 leading-relaxed">
                Your squad is ready for action. Share this Varsity Access Pass with team members so they can claim gear custody, view manifests, and track game-day readiness.
              </p>
            </div>

            {/* Copy / Share buttons */}
            <div className="flex gap-3 mt-2 w-full">
              <button
                type="button"
                onClick={copyLink}
                className="flex-1 min-h-[48px] border-2 border-brand-border bg-white font-headline font-bold text-xs uppercase tracking-widest text-brand-text flex items-center justify-center hover:bg-brand-bg transition-colors active:scale-95"
              >
                {copied ? 'COPIED!' : 'COPY LINK'}
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 min-h-[48px] border-2 border-brand-border bg-white font-headline font-bold text-xs uppercase tracking-widest text-brand-text flex items-center justify-center hover:bg-brand-bg transition-colors active:scale-95"
              >
                SHARE
              </button>
            </div>

            <p className="font-body text-xs text-brand-muted text-center lg:text-left leading-relaxed">
              Anyone with this link or QR code can instantly onboard and contribute to the equipment manifest.
            </p>

            {/* Enter mission */}
            <button
              type="button"
              onClick={() => navigate(`/groups/${groupId}`)}
              className="w-full min-h-[48px] mt-2 bg-primary text-white font-headline font-bold text-sm uppercase tracking-widest flex items-center justify-center rounded-sm hover:brightness-105 active:scale-[0.99] transition-all shadow-sm"
            >
              <span className="inline-flex items-center justify-center gap-1.5">ENTER MISSION <ArrowRight className="w-4 h-4" /></span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root component ────────────────────────────────────────────────────────────

export function CreateGroupPage() {
  const [step, setStep]               = useState<Step>(1);
  const [groupId, setGroupId]         = useState<string | null>(null);
  const [groupName, setGroupName]     = useState<string>('');
  const [activityId, setActivityId]   = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  return (
    <PageLayout maxWidthClassName="max-w-md md:max-w-4xl lg:max-w-6xl">
      <div className="pt-2 md:pt-4 pb-6">
        <StepTracker currentStep={step} />

        {step === 1 && (
          <Step1
            onSuccess={(gId, aId, name) => {
              setGroupId(gId);
              setActivityId(aId);
              setGroupName(name);
              setStep(2);
            }}
          />
        )}

        {step === 2 && groupId && activityId && (
          <Step2
            groupId={groupId}
            activityId={activityId}
            onBack={() => setStep(1)}
            onSuccess={(token) => {
              setInviteToken(token);
              setStep(3);
            }}
          />
        )}

        {step === 3 && groupId && inviteToken && (
          <Step3
            groupId={groupId}
            groupName={groupName}
            inviteToken={inviteToken}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </PageLayout>
  );
}
