// An error the API expects and knows how to describe to the client.
// Throw one anywhere in a route or service; the central error handler turns
// it into the standard JSON response:
//   { "error": { "code", "message", "details"? } }
//
// status  - HTTP status code (e.g. 404)
// code    - stable machine-readable code the frontend can check (e.g. "NOT_FOUND")
// message - human-readable explanation, safe to show to users
// details - optional extra data (e.g. per-field validation messages)

class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    // Marker used by isAppError(). Safer than `instanceof`, which fails if
    // this file is ever loaded twice (e.g. once by Node and once by Vitest).
    this.isAppError = true;
  }
}

function isAppError(err) {
  return Boolean(err && err.isAppError === true);
}

module.exports = { AppError, isAppError };
