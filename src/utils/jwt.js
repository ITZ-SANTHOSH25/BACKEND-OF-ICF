'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

/** Sign an access token for a user row. */
function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

/** Verify a token and return its payload, or throw. */
function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = { signToken, verifyToken };
