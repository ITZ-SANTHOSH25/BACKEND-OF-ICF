'use strict';

const bcrypt = require('bcryptjs');

const ROUNDS = 10;

/** Hash a plaintext password. */
function hashPassword(plain) {
  return bcrypt.hashSync(String(plain), ROUNDS);
}

/** Compare a plaintext password against a stored hash. */
function verifyPassword(plain, hash) {
  if (!hash) return false;
  try {
    return bcrypt.compareSync(String(plain), hash);
  } catch {
    return false;
  }
}

module.exports = { hashPassword, verifyPassword };
