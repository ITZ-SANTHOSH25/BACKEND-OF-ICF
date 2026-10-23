'use strict';

/**
 * Applies the SQLite schema. Pass `--reset` to drop the database file first.
 * Usage: node src/db/migrate.js [--reset]
 */
const fs = require('fs');
const env = require('../config/env');

const reset = process.argv.includes('--reset');

if (reset) {
  for (const suffix of ['', '-wal', '-shm']) {
    const f = env.dbFile + suffix;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
  // eslint-disable-next-line no-console
  console.log('• Dropped existing database.');
}

const { migrate } = require('../config/db');
migrate();

// eslint-disable-next-line no-console
console.log(`✓ Schema applied at ${env.dbFile}`);
