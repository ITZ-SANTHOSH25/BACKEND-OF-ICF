'use strict';

const ApiError = require('../utils/ApiError');
const env = require('../config/env');

/** 404 handler for unmatched routes. */
function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/** Central error handler — always returns JSON. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  // Translate common SQLite errors into friendly messages.
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    status = 409;
    message = 'A record with those details already exists.';
  }

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[LifeLink] Unhandled error:', err);
    if (env.isProd) message = 'Internal server error';
  }

  res.status(status).json({
    success: false,
    error: { message, ...(details ? { details } : {}) },
  });
}

/** Wrap async route handlers so thrown errors reach the error handler. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { notFound, errorHandler, asyncHandler };
