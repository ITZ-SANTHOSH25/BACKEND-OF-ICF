'use strict';
const path = require('path');
require('dotenv').config();
const env = {
 nodeEnv: process.env.NODE_ENV || 'development', port: Number(process.env.PORT || 5000),
 publicBaseUrl: (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, ''),
 corsOrigin: process.env.CORS_ORIGIN || '*', jwtSecret: process.env.JWT_SECRET || '', jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
 mongoUri: process.env.MONGODB_URI || '',
 cashfreeAppId: process.env.CASHFREE_APP_ID || '',
 cashfreeSecretKey: process.env.CASHFREE_SECRET_KEY || '',
 cashfreeApiVersion: process.env.CASHFREE_API_VERSION || '2025-01-01',
 cashfreeEnvironment: (process.env.CASHFREE_ENVIRONMENT || 'sandbox').toLowerCase(),
 frontendReturnUrl: process.env.FRONTEND_RETURN_URL || '',
 uploadDir: path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || './uploads'),
 maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024, root: path.resolve(__dirname, '..', '..')
};
env.isProd = env.nodeEnv === 'production'; env.isTest = env.nodeEnv === 'test';
if (!env.jwtSecret && !env.isProd) env.jwtSecret = 'local-development-only-change-me';
if (env.isProd && !env.jwtSecret) throw new Error('JWT_SECRET is required in production.');
module.exports = env;
