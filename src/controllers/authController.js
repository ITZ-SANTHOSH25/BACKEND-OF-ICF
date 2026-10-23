'use strict';

const { db } = require('../config/db');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const { uid } = require('../utils/helpers');

const ROLES = ['donor', 'hospital', 'authority'];

/** Public shape of a user (never leaks the password hash). */
function publicUser(user) {
  const base = {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    location: user.location || '',
    createdAt: user.created_at,
  };

  if (user.role === 'hospital') {
    const h = db.prepare('SELECT * FROM hospitals WHERE user_id = ?').get(user.id);
    base.hospital = h
      ? { name: h.name, id: h.reg_id, address: h.address, contact: h.contact, email: h.email, doctor: h.doctor }
      : null;
  }
  if (user.role === 'authority') {
    const a = db.prepare('SELECT * FROM authorities WHERE user_id = ?').get(user.id);
    base.authority = a
      ? { name: a.name, id: a.authority_id, officer: a.officer, email: a.email }
      : null;
  }
  return base;
}

/**
 * POST /api/auth/register
 * Creates a donor, hospital or authority account.
 * Body: { role, name, email, password, phone?, location?, org?: {...} }
 */
function register(req, res) {
  const { role = 'donor', name, email, password, phone = '', location = '' } = req.body || {};

  if (!ROLES.includes(role)) throw ApiError.badRequest('Invalid role.');
  if (!email || !password) throw ApiError.badRequest('Email and password are required.');
  if (String(password).length < 6) throw ApiError.badRequest('Password must be at least 6 characters.');

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (existing) throw ApiError.conflict('An account with that email already exists.');

  const create = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO users (role, name, email, password_hash, phone, location)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(role, name || '', String(email).toLowerCase(), hashPassword(password), phone, location);

    const userId = info.lastInsertRowid;

    if (role === 'hospital') {
      const org = req.body.org || {};
      const regId = org.id || uid('HOSP');
      db.prepare(
        `INSERT INTO hospitals (user_id, name, reg_id, address, contact, email, doctor)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(userId, org.name || name || '', regId, org.address || '', org.contact || phone, org.email || email, org.doctor || '');
    }

    if (role === 'authority') {
      const org = req.body.org || {};
      const authId = org.id || uid('AUTH');
      db.prepare(
        `INSERT INTO authorities (user_id, name, authority_id, officer, email)
         VALUES (?, ?, ?, ?, ?)`
      ).run(userId, org.name || name || '', authId, org.officer || name || '', org.email || email);
    }

    db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(userId);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  });

  const user = create();
  const token = signToken(user);
  res.status(201).json({ success: true, data: { token, user: publicUser(user) } });
}

/**
 * POST /api/auth/login
 * Body: { email, password, role? }
 * `email` may be an email address, a Hospital Reg. ID or an Authority ID.
 */
function login(req, res) {
  const { email, password, role } = req.body || {};
  if (!email || !password) throw ApiError.badRequest('Credentials are required.');

  const ident = String(email).trim();

  // Resolve by email first, then by hospital reg_id / authority id.
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(ident.toLowerCase());

  if (!user) {
    const h = db.prepare('SELECT user_id FROM hospitals WHERE reg_id = ?').get(ident);
    if (h) user = db.prepare('SELECT * FROM users WHERE id = ?').get(h.user_id);
  }
  if (!user) {
    const a = db.prepare('SELECT user_id FROM authorities WHERE authority_id = ?').get(ident);
    if (a) user = db.prepare('SELECT * FROM users WHERE id = ?').get(a.user_id);
  }

  if (!user || !verifyPassword(password, user.password_hash)) {
    throw ApiError.unauthorized('Invalid credentials.');
  }
  if (role && role !== user.role) {
    throw ApiError.forbidden(`This account is not a ${role} account.`);
  }

  const token = signToken(user);
  res.json({ success: true, data: { token, user: publicUser(user) } });
}

/** GET /api/auth/me */
function me(req, res) {
  res.json({ success: true, data: { user: publicUser(req.user) } });
}

/**
 * POST /api/auth/forgot-password
 * In a real deployment this would email a reset link. Here we acknowledge the
 * request without leaking whether the account exists.
 */
function forgotPassword(req, res) {
  const { email } = req.body || {};
  if (!email) throw ApiError.badRequest('Email is required.');
  res.json({
    success: true,
    data: {
      message: 'If an account exists for that address, a reset link has been sent.',
    },
  });
}

/** POST /api/auth/logout — stateless JWT; client discards the token. */
function logout(req, res) {
  res.json({ success: true, data: { message: 'Logged out.' } });
}

module.exports = { register, login, me, forgotPassword, logout, publicUser };
