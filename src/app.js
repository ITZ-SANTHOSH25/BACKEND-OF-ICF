'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security headers (relaxed CSP so the static frontend can load fonts/CDN).
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    })
  );

  // CORS.
  const corsOrigin = env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((s) => s.trim());
  app.use(cors({ origin: corsOrigin, credentials: true }));

  // Body parsers.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Logging.
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  // Basic rate limiting on the API.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: { message: 'Too many requests, please slow down.' } },
    })
  );

  // Serve uploaded documents.
  app.use('/uploads', express.static(env.uploadDir));

  // Backend routes.
  app.use('/api', routes);

  // 404 + error handling.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
