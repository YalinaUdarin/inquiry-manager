// /api/auth: sign in, sign out, and "who am I?".

const { Router } = require('express');
const { loginSchema } = require('../validation/schemas');
const { requireAuth } = require('../middleware/requireAuth');
const auth = require('../services/auth.service');

const router = Router();

// POST /api/auth/login  { email, password }
// 200 { user } and sets the session cookie; 400 bad input; 401 wrong credentials.
router.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body ?? {});
  const user = await auth.authenticate(email, password);

  res.cookie(auth.SESSION_COOKIE, auth.signSessionToken(user), {
    ...auth.sessionCookieOptions(),
    maxAge: auth.SESSION_HOURS * 60 * 60 * 1000, // cookie expires with the token
  });
  res.json({ user });
});

// POST /api/auth/logout
// 204 and clears the cookie. Works even when not signed in, so the frontend
// can always call it safely.
router.post('/logout', (req, res) => {
  res.clearCookie(auth.SESSION_COOKIE, auth.sessionCookieOptions());
  res.status(204).end();
});

// GET /api/auth/me
// 200 { user } for a valid session, otherwise 401. The frontend calls this on
// page load to decide whether to show the app or the login page.
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
