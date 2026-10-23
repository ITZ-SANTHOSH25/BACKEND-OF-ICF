'use strict';

/**
 * Centralised, validated environment configuration.
 * Loads variables from `.env` (via dotenv) and exposes typed values.
 */
const path = require('path');
require('dotenv').config();

function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const root = path.resolve(__dirname, '..', '..');

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/$/, ''),

  // CORS: "*" allows all, otherwise a comma-separated whitelist.
  corsOrigin: process.env.CORS_ORIGIN || '*',

  jwtSecret: process.env.JWT_SECRET || 'lifelink-dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  dbFile: path.resolve(root, process.env.DB_FILE || './data/lifelink.db'),
  uploadDir: path.resolve(root, process.env.UPLOAD_DIR || './uploads'),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024,

  root,
};

env.isProd = env.nodeEnv === 'production';
env.isTest = env.nodeEnv === 'test';

if (env.isProd && env.jwtSecret === 'lifelink-dev-secret-change-me') {
  // eslint-disable-next-line no-console
  console.warn('[LifeLink] WARNING: using the default JWT secret in production. Set JWT_SECRET.');
}

module.exports = env;
