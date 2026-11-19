// GET /api/health: tells you whether the API is up and can reach the database.
// Useful when setting up locally, and for the README's "check it works" step.

const { Router } = require('express');
const db = require('../db');

const router = Router();

router.get('/', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'up' });
  } catch {
    // 503 = the API itself is running, but a service it depends on isn't.
    res.status(503).json({ status: 'degraded', database: 'down' });
  }
});

module.exports = router;
