// Sign-in logic: checking credentials and creating/reading login tokens.
//
// How a session works:
// 1. Login checks the password and creates a signed token (JWT) that says
//    "this is user <id>". Nobody can forge or edit it without JWT_SECRET.
// 2. The token is stored in an httpOnly cookie, which the browser sends with
//    every request but page JavaScript can't read.
// 3. requireAuth verifies the token on each request (see middleware).

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const { AppError } = require('../errors');

const SESSION_COOKIE = 'session';
const SESSION_HOURS = 8;   // roughly one working day
const JWT_ALGORITHM = 'HS256';

// A real bcrypt hash of a random string. Used when the email doesn't exist,
// so a login attempt takes the same time either way. Otherwise an attacker
// could tell which emails are registered by how fast the server replies.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// The fields that are safe to send to the browser (never the password hash).
function toPublicUser(row) {
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

async function authenticate(email, password) {
  const { rows } = await db.query(
    'SELECT id, email, name, role, password_hash FROM users WHERE email = $1',
    [email], // the email column is citext, so this match ignores upper/lower case
  );
  const user = rows[0];

  const passwordOk = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
  if (!user || !passwordOk) {
    // Same message for "no such email" and "wrong password", on purpose.
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  return toPublicUser(user);
}

function signSessionToken(user) {
  return jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: user.id,
    algorithm: JWT_ALGORITHM,
    expiresIn: `${SESSION_HOURS}h`,
  });
}

// Returns the token's payload, or throws an AppError(401) explaining why not.
function verifySessionToken(token) {
  try {
    // Pinning the algorithm stops a forged token from choosing a weaker one.
    return jwt.verify(token, config.jwtSecret, { algorithms: [JWT_ALGORITHM] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError(401, 'UNAUTHENTICATED', 'Your session has expired. Please sign in again.');
    }
    throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  }
}

async function findUserById(id) {
  const { rows } = await db.query('SELECT id, email, name, role FROM users WHERE id = $1', [id]);
  return rows[0] ? toPublicUser(rows[0]) : null;
}

// Cookie settings, shared by login (set) and logout (clear) so they match.
function sessionCookieOptions() {
  return {
    httpOnly: true,               // page JavaScript can't read it (limits XSS damage)
    sameSite: 'lax',              // not sent on cross-site POST/PATCH (blocks CSRF)
    secure: config.cookieSecure,  // HTTPS-only in production
    path: '/',
  };
}

module.exports = {
  SESSION_COOKIE,
  SESSION_HOURS,
  authenticate,
  signSessionToken,
  verifySessionToken,
  findUserById,
  sessionCookieOptions,
};
