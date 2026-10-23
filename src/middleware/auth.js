'use strict';

const { verifyToken } = require('../utils/jwt');
const { db } = require('../config/db');
const ApiError = require('../utils/ApiError');

/** Extract a bearer token from the Authorization header. */
function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/**
 * Require a valid JWT. Attaches `req.user` (the DB row) when successful.
 */
function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return next(ApiError.unauthorized('Missing authentication token.'));

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return next(ApiError.unauthorized('Invalid or expired token.'));
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub);
  if (!user) return next(ApiError.unauthorized('Account no longer exists.'));

  req.user = user;
  next();
}

/**
 * Optional auth — attaches `req.user` if a valid token is present, otherwise
 * continues anonymously. Useful for public endpoints that personalise output.
 */
function optionalAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub) || null;
  } catch {
    req.user = null;
  }
  next();
}

/** Restrict a route to one or more roles. Must run after requireAuth. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`This action requires role: ${roles.join(' or ')}.`));
    }
    next();
  };
}

module.exports = { requireAuth, optionalAuth, requireRole };
