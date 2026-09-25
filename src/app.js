'use strict';

const path = require('node:path');
const express = require('express');
const { createAuth } = require('./auth');
const { createApiRouter } = require('./routes/api');
const { ensureSeeded } = require('./seed');

async function createApp(config, store) {
  await ensureSeeded(store, config);

  const auth = createAuth(config);
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: config.bodyLimit }));

  app.use('/api', createApiRouter({ config, store, auth }));

  app.use((req, res, next) => {
    res.setHeader(
      'Cache-Control',
      /\.(css|js|png|jpe?g|webp|svg|woff2?)$/i.test(req.path)
        ? 'public, max-age=3600'
        : 'no-store'
    );
    next();
  });

  app.use(express.static(config.publicDir, { index: 'index.html', extensions: ['html'] }));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
      return res.status(400).json({ error: 'Invalid request body' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  });

  return { app, config, store, auth };
}

module.exports = { createApp };