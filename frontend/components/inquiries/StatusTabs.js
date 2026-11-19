import { STATUSES, STATUS_LABELS } from '@/lib/status';

// Status filter buttons with a count on each, e.g. "New 2".
// counts comes from the API: { ALL, NEW, IN_PROGRESS, RESOLVED }.
export function StatusTabs({ value, counts, onChange }) {
  const tabs = [{ key: undefined, label: 'All', count: counts?.ALL }].concat(
    STATUSES.map((s) => ({ key: s, label: STATUS_LABELS[s], count: counts?.[s] })),
  );

  return (
    <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = value === tab.key;
        return (
          <button
            key={tab.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(tab.key)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${
              active
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-1.5 text-xs ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-600'}`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
