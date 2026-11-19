// "Showing 11–20 of 23" with Previous / Next buttons.

export function Pagination({ page, pageSize, total, totalPages, onPageChange, disabled }) {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  const button =
    'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ' +
    'hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 text-sm text-slate-600">
      <p>
        Showing <span className="font-medium text-slate-900">{first}–{last}</span> of{' '}
        <span className="font-medium text-slate-900">{total}</span>
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" className={button} disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </button>
          <span aria-current="page">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className={button}
            disabled={disabled || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </nav>
  );
}
