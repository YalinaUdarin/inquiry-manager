// Where the Express API runs. Override with API_URL if you change its port.
const API_URL = process.env.API_URL || 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cache Components (server-side caching and prerendering) is off on purpose:
  // every page here is behind a login and loads its data in the browser from
  // the Express API, so there is nothing for the Next.js server to cache.

  // Forward /api/* to Express. The browser only ever talks to this Next.js
  // origin, so the session cookie is first-party and no CORS setup is needed.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },

  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
