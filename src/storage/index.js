'use strict';

const FileStore = require('./file');
const MemoryStore = require('./memory');
const PostgresStore = require('./postgres');

function createStore(config) {
  switch (config.storageDriver) {
    case 'postgres':
      if (!config.databaseUrl) {
        throw new Error('STORAGE_DRIVER=postgres requires DATABASE_URL to be set.');
      }
      return new PostgresStore(config.databaseUrl);
    case 'memory':
      return new MemoryStore();
    case 'file':
    default:
      return new FileStore(config.storageDir);
  }
}

module.exports = { createStore };