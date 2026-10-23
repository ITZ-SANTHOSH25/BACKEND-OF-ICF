'use strict';

const { db } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { publicUser } = require('./authController');

/** GET /api/profile — full profile for the current user, plus donor stats. */
function getProfile(req, res) {
  const user = req.user;
  const data = { user: publicUser(user) };

  if (user.role === 'donor') {
    const donations = db.prepare('SELECT * FROM donations WHERE donor_id = ?').all(user.id);
    const total = donations.reduce((s, d) => s + d.amount, 0);
    const cases = new Set(donations.map((d) => d.case_id)).size;
    const saved = db.prepare('SELECT COUNT(*) AS n FROM saved_cases WHERE donor_id = ?').get(user.id).n;
    data.stats = { totalDonated: total, casesSupported: cases, savedCases: saved };
  }

  res.json({ success: true, data });
}

/**
 * PUT /api/profile
 * Body: { name?, phone?, location?, org?: { address, contact, email, doctor, officer, ... } }
 */
function updateProfile(req, res) {
  const b = req.body || {};
  const sets = [];
  const params = [];

  if (b.name !== undefined) { sets.push('name = ?'); params.push(b.name); }
  if (b.phone !== undefined) { sets.push('phone = ?'); params.push(b.phone); }
  if (b.location !== undefined) { sets.push('location = ?'); params.push(b.location); }

  if (sets.length) {
    sets.push(`updated_at = datetime('now')`);
    params.push(req.user.id);
    db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  }

  if (req.user.role === 'hospital' && b.org) {
    db.prepare(
      `UPDATE hospitals SET
         name = COALESCE(?, name),
         address = COALESCE(?, address),
         contact = COALESCE(?, contact),
         email = COALESCE(?, email),
         doctor = COALESCE(?, doctor)
       WHERE user_id = ?`
    ).run(b.org.name ?? null, b.org.address ?? null, b.org.contact ?? null, b.org.email ?? null, b.org.doctor ?? null, req.user.id);
  }

  if (req.user.role === 'authority' && b.org) {
    db.prepare(
      `UPDATE authorities SET
         name = COALESCE(?, name),
         officer = COALESCE(?, officer),
         email = COALESCE(?, email)
       WHERE user_id = ?`
    ).run(b.org.name ?? null, b.org.officer ?? null, b.org.email ?? null, req.user.id);
  }

  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ success: true, data: { user: publicUser(fresh) } });
}

/** GET /api/settings */
function getSettings(req, res) {
  let row = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id);
  if (!row) {
    db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(req.user.id);
    row = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id);
  }
  res.json({ success: true, data: { settings: { notifications: row.notifications, privacy: row.privacy } } });
}

/** PUT /api/settings  body { notifications?, privacy? } */
function updateSettings(req, res) {
  const b = req.body || {};
  db.prepare('INSERT OR IGNORE INTO settings (user_id) VALUES (?)').run(req.user.id);
  db.prepare(
    `UPDATE settings SET
       notifications = COALESCE(?, notifications),
       privacy = COALESCE(?, privacy),
       updated_at = datetime('now')
     WHERE user_id = ?`
  ).run(b.notifications ?? null, b.privacy ?? null, req.user.id);

  const row = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(req.user.id);
  res.json({ success: true, data: { settings: { notifications: row.notifications, privacy: row.privacy } } });
}

module.exports = { getProfile, updateProfile, getSettings, updateSettings };
