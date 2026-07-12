import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import api from '@/lib/api';

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

const ACTIVITY_OPTIONS: { value: ActivityKind; label: string; emoji: string }[] = [
  { value: 'COMPETITION', label: 'TOURNAMENT', emoji: '🏆' },
  { value: 'CASUAL',      label: 'AWAY GAME',  emoji: '✈️' },
  { value: 'TRAINING',    label: 'PRACTICE',   emoji: '🏃' },
];

// ─── Shared style atoms ───────────────────────────────────────────────────────

const labelCaps = 'font-headline text-xs uppercase tracking-widest text-brand-text';
const inputBase =
  'w-full border border-brand-border px-3 py-2 bg-white font-body text-brand-text rounded-none focus:outline-none focus:border-2 focus:border-brand-border placeholder:text-brand-muted text-sm';

// ─── Sub-components ───────────────────────────────────────────────────────────

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
    <div className="bg-brand-border text-white px-4 py-3 flex flex-col gap-0.5">
      <div className="flex items-center gap-4">
        <span className="font-headline font-bold text-sm">{left}</span>
        <span className="font-headline font-bold text-sm uppercase tracking-widest flex-1 text-center">
          {title}
        </span>
        {/* spacer to keep title centered */}
        <span className="font-headline font-bold text-sm opacity-0 select-none">{left}</span>
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
      const groupRes = await api.post('/groups', {
        name: trimmed,
        sportType: activityType,
        description: notes.trim() || undefined,
      });
      const group = groupRes.data;

      // 2. Create activity
      const activityRes = await api.post(`/groups/${group.id}/activities`, {
        name: 'Mission Activity',
        activityType,
      });
      const activity = activityRes.data;

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
    <div className="flex flex-col min-h-screen bg-brand-bg">
      <StepHeader
        left={
          <button
            onClick={() => navigate(-1)}
            className="font-headline font-bold text-white hover:opacity-70 transition-opacity"
            aria-label="Go back"
          >
            ← BACK
          </button>
        }
        title="NEW MISSION"
        sub={
          <p className="font-headline text-xs tracking-widest text-[#5C4037]">
            LOGISTICS ID: #GG-NEW
          </p>
        }
      />

      <div className="flex-1 px-4 py-6 flex flex-col gap-6">
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
            placeholder="Enter mission name..."
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
          <div className="grid grid-cols-3 gap-2">
            {ACTIVITY_OPTIONS.map((opt) => {
              const selected = activityType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setActivityType(opt.value)}
                  className={[
                    'flex flex-col items-center justify-center gap-1 py-3 border transition-colors',
                    selected
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-brand-text border-brand-border hover:border-primary',
                  ].join(' ')}
                >
                  <span className="text-2xl" aria-hidden>
                    {opt.emoji}
                  </span>
                  <span className="font-headline font-bold text-[10px] uppercase tracking-wider leading-tight text-center">
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

      {/* Sticky bottom */}
      <div className="px-4 pb-6 pt-2 bg-brand-bg border-t border-brand-border">
        <button
          type="button"
          onClick={handleContinue}
          disabled={loading}
          className="w-full min-h-[48px] bg-primary text-white font-headline font-bold text-sm uppercase tracking-widest flex items-center justify-center disabled:opacity-60 transition-opacity"
        >
          {loading ? 'CREATING...' : 'CONTINUE →'}
        </button>
        <p className="font-body text-xs text-brand-muted text-center mt-2 leading-relaxed">
          All group members will receive a notification to verify their equipment gear manifest once created.
        </p>
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
  // Start empty — user builds their own manifest
  const [items, setItems]               = useState<ItemEntry[]>([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName]     = useState('');
  const [customDesc, setCustomDesc]     = useState('');
  const [customQty, setCustomQty]       = useState(1);
  const [finishing, setFinishing]       = useState(false);
  const [serverError, setServerError]   = useState('');

  // All edits are local-only until Finish is clicked
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

  // On finish: POST all items to backend, then create invitation
  const handleFinish = async () => {
    setServerError('');
    setFinishing(true);
    try {
      // 1. Create all items in parallel
      if (items.length > 0) {
        await Promise.all(
          items.map((item) =>
            api.post(`/activities/${activityId}/shared-items`, {
              name: item.name,
              notes: item.description || undefined,
              requiredQuantity: item.quantity,
            }),
          ),
        );
      }

      // 2. Create invitation
      const res = await api.post(`/groups/${groupId}/invitations`, {
        expiresInHours: 168,
        maxUses: 50,
      });
      onSuccess(res.data.token as string);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create mission. Please try again.';
      setServerError(msg);
    } finally {
      setFinishing(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg">
      <StepHeader
        left={
          <button
            onClick={onBack}
            className="font-headline font-bold text-white hover:opacity-70 transition-opacity"
            aria-label="Back to step 1"
          >
            ← STEP 1
          </button>
        }
        title="ITEM MANIFEST"
        sub={
          <div className="flex justify-center gap-4">
            <span className="font-headline text-xs tracking-widest text-[#5C4037]">
              MISSION ID: #{groupId.slice(0, 8).toUpperCase()}
            </span>
            <span className="font-headline text-xs tracking-widest text-[#5C4037]">
              EST. WEIGHT: 0 KG
            </span>
          </div>
        }
      />

      <div className="flex-1 px-4 py-4 flex flex-col gap-0">
        {serverError && (
          <div className="border border-error bg-white px-4 py-3 mb-3">
            <p className="font-body text-sm text-error">{serverError}</p>
          </div>
        )}

        {/* Item list */}
        <div className="border border-brand-border bg-white">
          {items.length === 0 && !showCustomForm && (
            <div className="px-4 py-6 text-center">
              <p className="font-headline text-xs uppercase tracking-widest text-brand-muted">
                NO ITEMS YET
              </p>
              <p className="font-body text-xs text-brand-muted mt-1">
                Add items your group needs to bring.
              </p>
            </div>
          )}
          {items.map((item, idx) => (
            <div
              key={item.localId}
              className="flex items-stretch border-b border-brand-border last:border-b-0"
            >
              {/* Left: info */}
              <div className="flex-1 px-3 py-3">
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
              <div className="flex flex-col items-center justify-center px-3 py-3 gap-1 border-l border-brand-border min-w-[72px]">
                <span className="font-headline font-bold text-4xl text-brand-text leading-none">
                  {item.quantity}
                </span>
                <div className="flex gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.localId, -1)}
                    aria-label={`Decrease ${item.name}`}
                    className="w-8 h-8 border border-brand-border font-headline font-bold text-lg flex items-center justify-center hover:bg-brand-bg transition-colors"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.localId, 1)}
                    aria-label={`Increase ${item.name}`}
                    className="w-8 h-8 border border-brand-border font-headline font-bold text-lg flex items-center justify-center hover:bg-brand-bg transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Custom item form inline */}
          {showCustomForm && (
            <div className="border-b border-brand-border last:border-b-0 px-3 py-3 bg-brand-bg flex flex-col gap-2">
              <p className={`${labelCaps} text-[10px]`}>NEW ITEM</p>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Item name..."
                className={`${inputBase} text-xs py-1.5`}
              />
              <input
                type="text"
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="Description (optional)..."
                className={`${inputBase} text-xs py-1.5`}
              />
              <div className="flex items-center gap-2">
                <span className="font-body text-xs text-brand-muted">QTY:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCustomQty((q) => Math.max(1, q - 1))}
                    className="w-8 h-8 border border-brand-border font-headline font-bold text-lg flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="font-headline font-bold text-lg w-8 text-center">
                    {customQty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCustomQty((q) => q + 1)}
                    className="w-8 h-8 border border-brand-border font-headline font-bold text-lg flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAddCustom}
                  disabled={!customName.trim()}
                  className="ml-auto bg-primary text-white font-headline font-bold text-xs uppercase tracking-widest px-4 h-8 disabled:opacity-60"
                >
                  ADD
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomForm(false)}
                  className="font-headline text-xs text-brand-muted uppercase tracking-widest px-2 h-8"
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
            className="w-full mt-3 min-h-[48px] border border-dashed border-brand-border bg-white font-headline font-bold text-xs uppercase tracking-widest text-brand-text flex items-center justify-center gap-2 hover:bg-brand-bg transition-colors"
          >
            + REQUEST CUSTOM ITEM
          </button>
        )}
      </div>

      {/* Sticky bottom */}
      <div className="px-4 pb-6 pt-2 bg-brand-bg border-t border-brand-border">
        <button
          type="button"
          onClick={handleFinish}
          disabled={finishing}
          className="w-full min-h-[48px] bg-primary text-white font-headline font-bold text-sm uppercase tracking-widest flex items-center justify-center disabled:opacity-60 transition-opacity"
        >
          {finishing ? 'GENERATING...' : 'FINISH & INVITE →'}
        </button>
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
        .share({ title: 'Join my GearGuardian mission', url: inviteLink })
        .catch(() => {});
    } else {
      copyLink();
    }
  };

  const tokenShort = inviteToken.slice(0, 8).toUpperCase();
  const tokenPreview = inviteToken.slice(0, 12);

  return (
    <div className="flex flex-col min-h-screen bg-brand-bg">
      <StepHeader
        left={
          <button
            onClick={onBack}
            className="font-headline font-bold text-white hover:opacity-70 transition-opacity"
            aria-label="Back to item manifest"
          >
            ← BACK
          </button>
        }
        title="JOIN MISSION"
      />

      <div className="flex-1 px-4 py-6 flex flex-col items-center">
        <p className="font-body text-sm text-brand-muted text-center mb-4">
          Your mission is ready. Share this access pass.
        </p>

        {/* Access Pass Card */}
        <div className="w-full border-2 border-brand-border bg-white rounded-lg overflow-hidden">
          {/* Card header strip */}
          <div className="bg-brand-border px-4 py-3">
            <p className="font-headline font-bold text-xs uppercase tracking-widest text-white">
              VARSITY ACCESS PASS
            </p>
            <p className="font-headline font-bold text-base uppercase text-white mt-0.5">
              {groupName}
            </p>
          </div>

          {/* QR code */}
          <div className="flex justify-center py-6">
            <QRCodeSVG
              value={inviteLink}
              size={180}
              bgColor="#FFFFFF"
              fgColor="#1A1A1A"
              level="M"
            />
          </div>

          {/* Divider */}
          <div className="border-t border-brand-border mx-4" />

          {/* Pass details */}
          <div className="px-4 py-3 flex flex-col gap-1">
            <p className="font-headline text-xs uppercase tracking-widest text-brand-text">
              SERIAL: #{tokenShort}
            </p>
            <p className="font-headline text-xs uppercase tracking-widest text-brand-text">
              EXPIRES: 7 DAYS
            </p>
            <p className="font-body text-xs text-brand-muted truncate mt-0.5">
              gearguardian.app/join/{tokenPreview}
            </p>
          </div>
        </div>

        {/* Copy / Share buttons */}
        <div className="flex gap-3 mt-4 w-full">
          <button
            type="button"
            onClick={copyLink}
            className="flex-1 min-h-[48px] border border-brand-border bg-white font-headline font-bold text-xs uppercase tracking-widest text-brand-text flex items-center justify-center hover:bg-brand-bg transition-colors"
          >
            {copied ? 'COPIED!' : 'COPY LINK'}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 min-h-[48px] border border-brand-border bg-white font-headline font-bold text-xs uppercase tracking-widest text-brand-text flex items-center justify-center hover:bg-brand-bg transition-colors"
          >
            SHARE
          </button>
        </div>

        <p className="font-body text-xs text-brand-muted text-center mt-3 leading-relaxed">
          Anyone with this link or QR code can join your mission and add items.
        </p>

        {/* Enter mission */}
        <button
          type="button"
          onClick={() => navigate(`/groups/${groupId}`)}
          className="w-full min-h-[48px] mt-6 bg-primary text-white font-headline font-bold text-sm uppercase tracking-widest flex items-center justify-center"
        >
          ENTER MISSION →
        </button>
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

  if (step === 1) {
    return (
      <Step1
        onSuccess={(gId, aId, name) => {
          setGroupId(gId);
          setActivityId(aId);
          setGroupName(name);
          setStep(2);
        }}
      />
    );
  }

  if (step === 2 && groupId && activityId) {
    return (
      <Step2
        groupId={groupId}
        activityId={activityId}
        onBack={() => setStep(1)}
        onSuccess={(token) => {
          setInviteToken(token);
          setStep(3);
        }}
      />
    );
  }

  if (step === 3 && groupId && inviteToken) {
    return (
      <Step3
        groupId={groupId}
        groupName={groupName}
        inviteToken={inviteToken}
        onBack={() => setStep(2)}
      />
    );
  }

  // Fallback (should not reach)
  return null;
}
