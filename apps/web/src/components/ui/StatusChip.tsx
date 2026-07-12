import clsx from 'clsx';

type StatusType =
  | 'packed'
  | 'claimed'
  | 'missing'
  | 'urgent'
  | 'ready'
  | 'in-progress';

interface StatusChipProps {
  status: StatusType;
  label?: string;
}

const statusConfig: Record<
  StatusType,
  { bg: string; text: string; border: string }
> = {
  packed: {
    bg: 'bg-[#2D6A4F]',
    text: 'text-white',
    border: 'border-[#2D6A4F]',
  },
  claimed: {
    bg: 'bg-transparent',
    text: 'text-brand-text',
    border: 'border-brand-border',
  },
  missing: {
    bg: 'bg-primary',
    text: 'text-white',
    border: 'border-primary',
  },
  urgent: {
    bg: 'bg-primary',
    text: 'text-white',
    border: 'border-primary',
  },
  ready: {
    bg: 'bg-transparent',
    text: 'text-[#2D6A4F]',
    border: 'border-[#2D6A4F]',
  },
  'in-progress': {
    bg: 'bg-transparent',
    text: 'text-brand-text',
    border: 'border-brand-border',
  },
};

const statusLabels: Record<StatusType, string> = {
  packed: 'PACKED',
  claimed: 'CLAIMED',
  missing: 'MISSING',
  urgent: 'URGENT',
  ready: 'READY',
  'in-progress': 'IN PROGRESS',
};

export function StatusChip({ status, label }: StatusChipProps) {
  const config = statusConfig[status];
  const displayLabel = label ?? statusLabels[status];

  return (
    <span
      className={clsx(
        'inline-block border px-2 py-1 font-headline text-xs uppercase tracking-wider',
        config.bg,
        config.text,
        config.border,
      )}
    >
      {displayLabel}
    </span>
  );
}
