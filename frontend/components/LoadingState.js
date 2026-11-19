// Shown while data loads.
// - Default: a short message with a spinner.
// - rows={n}: grey placeholder rows shaped like the content (a "skeleton"),
//   so the page doesn't jump when the real data arrives.

export function LoadingState({ label = 'Loading…', rows, fullPage = false }) {
  if (rows) {
    return (
      <div role="status" aria-label={label} className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-slate-100" />
        ))}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-3 text-sm text-slate-600 ${fullPage ? 'min-h-screen' : 'py-12'}`}
    >
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
      />
      {label}
    </div>
  );
}
