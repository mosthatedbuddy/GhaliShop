'use strict';

/**
 * Vercel serverless entry point.
 *
 * Vercel invokes this handler with Node-style (req, res). We simply hand the
 * request to the same Express app used by server.js and resolve only once the
 * response has finished writing.
 *
 * Storage note: the Vercel filesystem is read-only, so this function is
 * automatically configured with the `memory` driver unless DATABASE_URL is set
 * (which enables the durable Postgres backend).
 */

require('dotenv').config();

const { loadConfig } = require('../src/config');
const { createStore } = require('../src/storage');
const { createApp } = require('../src/app');

let cachedApp = null;

async function getApp() {
  if (!cachedApp) {
    const config = loadConfig();
    const store = createStore(config);
    await store.initialize();
    const { app } = await createApp(config, store);
    cachedApp = app;
  }
  return cachedApp;
}

module.exports = async function handler(request, response) {
  const app = await getApp();
  await new Promise((resolve) => {
    response.on('finish', resolve);
    app(request, response);
  });
};