'use strict';

/**
 * SQLite connection (better-sqlite3) — synchronous, fast, zero-config.
 * The database file lives at `env.dbFile`; the schema is applied on boot.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const env = require('./env');
const { hashPassword } = require('../utils/password');

// Ensure the data directory exists.
fs.mkdirSync(path.dirname(env.dbFile), { recursive: true });

const db = new Database(env.dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/** Apply the schema (idempotent — uses CREATE TABLE IF NOT EXISTS). */
function migrate() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  db.exec(schema);
  return db;
}
// Apply schema immediately.
migrate();

// Create demo Hospital and Authority accounts if they do not exist.
function seedDemoAccounts() {
  const createHospital = db.transaction(() => {
    const existing = db.prepare(
      'SELECT user_id FROM hospitals WHERE reg_id = ?'
    ).get('HOSP001');

    if (!existing) {
      const user = db.prepare(`
        INSERT INTO users (role, name, email, password_hash, phone, location)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'hospital',
        'Demo Hospital',
        'demo.hospital@icf.local',
        hashPassword('Hospital@123'),
        '',
        ''
      );

      db.prepare(`
        INSERT INTO hospitals
        (user_id, name, reg_id, address, contact, email, doctor)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        user.lastInsertRowid,
        'Demo Hospital',
        'HOSP001',
        '',
        '',
        'demo.hospital@icf.local',
        ''
      );

      db.prepare(
        'INSERT INTO settings (user_id) VALUES (?)'
      ).run(user.lastInsertRowid);
    }
  });

  const createAuthority = db.transaction(() => {
    const existing = db.prepare(
      'SELECT user_id FROM authorities WHERE authority_id = ?'
    ).get('AUTH001');

    if (!existing) {
      const user = db.prepare(`
        INSERT INTO users (role, name, email, password_hash, phone, location)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        'authority',
        'Demo Authority',
        'demo.authority@icf.local',
        hashPassword('Authority@123'),
        '',
        ''
      );

      db.prepare(`
        INSERT INTO authorities
        (user_id, name, authority_id, officer, email)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        user.lastInsertRowid,
        'Demo Authority',
        'AUTH001',
        'Demo Officer',
        'demo.authority@icf.local'
      );

      db.prepare(
        'INSERT INTO settings (user_id) VALUES (?)'
      ).run(user.lastInsertRowid);
    }
  });

  createHospital();
  createAuthority();
}

seedDemoAccounts();

module.exports = { db, migrate };
