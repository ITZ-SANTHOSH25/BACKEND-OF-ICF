'use strict';

/**
 * SQLite connection (better-sqlite3) — synchronous, fast, zero-config.
 * The database file lives at `env.dbFile`; the schema is applied on boot.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const env = require('./env');

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

// Apply schema immediately so any require() gets a ready database.
migrate();

module.exports = { db, migrate };
