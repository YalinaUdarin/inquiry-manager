// Cache keys for TanStack Query, defined in one place so every component
// reads and refreshes the same entries.
//   ['inquiries']                    → everything inquiry-related
//   ['inquiries', 'list', {filters}] → one page of the list
//   ['inquiries', 'detail', id]      → one inquiry

export const queryKeys = {
  me: ['me'],
  inquiries: {
    all: ['inquiries'],
    list: (filters) => ['inquiries', 'list', filters],
    detail: (id) => ['inquiries', 'detail', id],
  },
};
