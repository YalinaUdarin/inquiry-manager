// Protects routes: only signed-in users get through.
// On success, sets req.user = { id, email, name, role } for later handlers.
// On failure, responds 401 UNAUTHENTICATED (via the error handler).
//
// This is the backend enforcement the brief asks for: hiding pages in the
// frontend is only a convenience; this check is what actually blocks access.

const { AppError } = require('../errors');
const { SESSION_COOKIE, verifySessionToken, findUserById } = require('../services/auth.service');

async function requireAuth(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  }

  const payload = verifySessionToken(token); // throws 401 if forged or expired

  // Load the user fresh from the database instead of trusting the token alone.
  // Trade-off: one small query per request, in exchange for a deleted account
  // or changed role taking effect immediately rather than when the token expires.
  const user = await findUserById(payload.sub);
  if (!user) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  }

  req.user = user;
  next();
}

module.exports = { requireAuth };
