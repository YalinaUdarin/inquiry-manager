'use client';

import { useEffect, useState } from 'react';

const DEBOUNCE_MS = 300;

// Search input that waits until the user pauses typing (300 ms) before
// searching, instead of sending a request on every keystroke.
//
// `value` is the search currently in the URL; `onSearch` updates it.
export function SearchBox({ value = '', onSearch }) {
  const [text, setText] = useState(value);
  const [lastValue, setLastValue] = useState(value);

  // If the URL's search changes from outside (e.g. "Clear filters", or the
  // back button), show that in the box. This is React's recommended way to
  // adjust state when a prop changes: during render, not in an effect.
  if (value !== lastValue) {
    setLastValue(value);
    if (text.trim() !== value) setText(value);
  }

  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed === value) return undefined;
    const timer = setTimeout(() => onSearch(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(timer); // typed again before 300 ms: restart the wait
  }, [text, value, onSearch]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <label htmlFor="inquiry-search" className="sr-only">
        Search inquiries
      </label>
      <input
        id="inquiry-search"
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search name, subject or contact"
        maxLength={100}
        className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
      />
    </div>
  );
}
