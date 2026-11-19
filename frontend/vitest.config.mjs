import { fileURLToPath } from 'node:url';
import { defineConfig, transformWithOxc } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = fileURLToPath(new URL('./', import.meta.url));

// Next.js lets components use JSX in plain .js files; Vite (used by Vitest)
// only expects JSX in .jsx files. This plugin compiles the project's own .js
// files as JSX so tests can import the same components the app uses.
function jsxInJsFiles() {
  return {
    name: 'jsx-in-js-files',
    enforce: 'pre',
    async transform(code, id) {
      if (!id.endsWith('.js') || id.includes('/node_modules/')) return null;
      return transformWithOxc(code, id, { lang: 'jsx', jsx: { runtime: 'automatic' } });
    },
  };
}

export default defineConfig({
  plugins: [jsxInJsFiles(), react()],
  resolve: {
    // Same "@/..." import shortcut as jsconfig.json uses for Next.js.
    alias: [{ find: /^@\//, replacement: projectRoot }],
  },
  test: {
    environment: 'jsdom', // a simulated browser, so components can render
    setupFiles: ['./vitest.setup.mjs'],
    include: ['__tests__/**/*.test.{js,jsx}'],
    // jsdom rendering can be slow on a cold start, especially on Windows.
    testTimeout: 15_000,
  },
});
