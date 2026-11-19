// Shown when there is nothing to list, with a next step (e.g. "Create one").

export function EmptyState({ title, message, action }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 px-6 py-12 text-center">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {message && <p className="mt-1 text-sm text-slate-600">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
