// Turns every error into the same JSON shape, so the frontend only has one
// format to handle:
//   { "error": { "code": "...", "message": "...", "details": { ... } } }
//
// Express 5 forwards errors thrown in async route handlers here automatically.

const { ZodError } = require('zod');
const { isAppError } = require('../errors');
const config = require('../config');

function sendError(res, status, code, message, details) {
  const body = { error: { code, message } };
  if (details !== undefined) body.error.details = details;
  res.status(status).json(body);
}

// Converts zod issues into { fieldName: "first message for that field" }.
function fieldErrors(zodError) {
  const details = {};
  for (const issue of zodError.issues) {
    const field = issue.path.join('.') || '_';
    if (!details[field]) details[field] = issue.message;
  }
  return details;
}

// Express recognises an error handler by its 4 parameters, so `next` must
// stay in the signature even when it isn't used.
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (isAppError(err)) {
    return sendError(res, err.status, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Some fields are missing or invalid.', fieldErrors(err));
  }

  // Thrown by express.json() for malformed or oversized request bodies.
  if (err.type === 'entity.parse.failed') {
    return sendError(res, 400, 'INVALID_JSON', 'The request body is not valid JSON.');
  }
  if (err.type === 'entity.too.large') {
    return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
  }

  // A database CHECK constraint failed. API validation should catch bad data
  // first, so this is a safety net rather than the normal path.
  if (err.code === '23514') {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Some fields are missing or invalid.');
  }

  // Anything else is a bug or an outage. Log the details on the server, but
  // never send stack traces or internal messages to the client.
  if (!config.isTest) console.error(err);
  return sendError(res, 500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
}

// For requests that matched no route at all.
function notFoundHandler(req, res) {
  sendError(res, 404, 'NOT_FOUND', `No route for ${req.method} ${req.path}.`);
}

module.exports = { errorHandler, notFoundHandler, fieldErrors };
