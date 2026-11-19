// A labelled input or textarea with its error message underneath.
// Accessibility: the label is linked to the input, an invalid field is marked
// aria-invalid, and the error text is linked with aria-describedby so screen
// readers read it out when the field is focused.

const baseInput =
  'block w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ' +
  'placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-50';

export function FormField({
  id,
  label,
  error,
  hint,
  multiline = false,
  inputRef,
  ...inputProps
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  // The hint is hidden while an error is shown, so only link what's visible.
  const describedBy = error ? errorId : hint ? hintId : undefined;
  const Input = multiline ? 'textarea' : 'input';

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-800">
        {label}
      </label>
      <Input
        id={id}
        ref={inputRef}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        className={`${baseInput} ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
            : 'border-slate-300 focus:border-slate-500 focus:ring-slate-200'
        }`}
        {...inputProps}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
