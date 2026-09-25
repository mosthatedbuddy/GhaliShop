'use strict';

require('dotenv').config();

const { loadConfig } = require('./src/config');
const { createStore } = require('./src/storage');
const { createApp } = require('./src/app');

async function start() {
  const config = loadConfig();
  const store = createStore(config);
  await store.initialize();

  const { app } = await createApp(config, store);
  const server = app.listen(config.port, () => {
    console.log(
      `GhaliShop running at http://localhost:${config.port} (storage: ${config.storageDriver})`
    );
  });

  function shutdown() {
    server.close(() => process.exit(0));
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});