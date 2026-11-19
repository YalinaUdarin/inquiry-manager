// Builds the Express app. It doesn't start listening; server.js does that.
// Keeping them separate lets tests load the app and send requests to it
// directly (with supertest) without opening a real network port.

const express = require('express');
const cookieParser = require('cookie-parser');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  // Don't advertise which framework the server runs on.
  app.disable('x-powered-by');

  // Parse JSON bodies. The size limit stops oversized requests early.
  app.use(express.json({ limit: '100kb' }));
  // Read cookies (the login token is stored in one, from Phase 3).
  app.use(cookieParser());

  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);

  // Order matters: these two must come after all routes.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
