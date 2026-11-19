import { STATUS_LABELS, STATUS_BADGE_CLASSES } from '@/lib/status';

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STATUS_BADGE_CLASSES[status] ?? 'bg-slate-100 text-slate-700 ring-slate-500/20'
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
