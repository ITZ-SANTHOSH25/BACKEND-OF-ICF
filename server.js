'use strict';

const createApp = require('./src/app');
const env = require('./src/config/env');
const { migrate } = require('./src/config/db');

// Ensure the schema exists before serving traffic.
migrate();

const app = createApp();

const server = app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`\n  LifeLink backend running`);
  console.log(`  → http://localhost:${env.port}`);
  console.log(`  → Env: ${env.nodeEnv}\n`);
});

// Graceful shutdown.
['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, () => {
    // eslint-disable-next-line no-console
    console.log(`\nReceived ${sig}, shutting down…`);
    server.close(() => process.exit(0));
  });
});

module.exports = server;
