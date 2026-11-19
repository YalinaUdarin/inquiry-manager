// Shown when loading data fails. Offers Retry when the failure might be
// temporary, plus an optional extra action (e.g. "Back to inquiries").

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  action,
  fullPage = false,
}) {
  return (
    <div className={`flex items-center justify-center ${fullPage ? 'min-h-screen px-4' : 'py-12'}`}>
      <div role="alert" className="max-w-md rounded-lg border border-red-200 bg-red-50 p-5 text-center">
        <h2 className="font-semibold text-red-900">{title}</h2>
        {message && <p className="mt-1 text-sm text-red-800">{message}</p>}
        {(onRetry || action) && (
          <div className="mt-4 flex justify-center gap-3">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
              >
                Try again
              </button>
            )}
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
