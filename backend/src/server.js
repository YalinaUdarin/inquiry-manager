// Entry point: starts the HTTP server.
// Run with `npm run dev` (restarts on file changes) or `npm start`.

const config = require('./config');
const { createApp } = require('./app');
const { pool } = require('./db');

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port} (${config.env})`);
});

// On Ctrl+C or a stop signal: stop accepting requests, let current ones
// finish, then close the database connections before exiting.
function shutdown(signal) {
  console.log(`\n${signal} received, shutting down…`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
