// Rejects malformed IDs (e.g. /api/inquiries/abc) with a clear 400 before
// they reach the database. Without this, PostgreSQL would throw an
// "invalid input syntax for type uuid" error, which would surface as a 500.

const { AppError } = require('../errors');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

// Usage: router.get('/:id', validateUuid('id'), handler)
function validateUuid(paramName = 'id') {
  return (req, res, next) => {
    if (!isUuid(req.params[paramName])) {
      return next(new AppError(400, 'INVALID_ID', 'That ID is not valid.'));
    }
    next();
  };
}

module.exports = { validateUuid, isUuid };
