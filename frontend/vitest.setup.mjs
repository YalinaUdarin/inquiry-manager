// Runs before every test file.
import '@testing-library/jest-dom/vitest'; // adds matchers like toBeInTheDocument()
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Remove whatever the previous test rendered.
afterEach(() => cleanup());
