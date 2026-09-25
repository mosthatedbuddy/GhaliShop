'use strict';

const path = require('node:path');

const STORAGE_DRIVERS = ['file', 'memory', 'postgres'];

function csv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadConfig(env = process.env) {
  const root = process.cwd();
  const explicitDriver = String(env.STORAGE_DRIVER || '').toLowerCase();
  const isVercel = env.VERCEL === '1';
  const defaultDriver = env.DATABASE_URL ? 'postgres' : isVercel ? 'memory' : 'file';
  const storageDriver = STORAGE_DRIVERS.includes(explicitDriver) ? explicitDriver : defaultDriver;

  return {
    root,
    env,
    port: Number(env.PORT) || 3000,
    adminPassword: env.ADMIN_PASSWORD || 'admin1234@@',
    sessionSecret: env.SESSION_SECRET || null,
    sessionMinutes: Math.max(5, Number(env.SESSION_TTL_MINUTES) || 30),
    storageDriver,
    storageDir: env.STORAGE_DIR ? path.resolve(root, env.STORAGE_DIR) : path.join(root, 'data'),
    databaseUrl: env.DATABASE_URL || '',
    corsAllowedOrigins: csv(env.ALLOWED_ORIGINS || env.FRONTEND_ORIGIN),
    bodyLimit: env.BODY_LIMIT || '10mb',
    seedCatalog: env.SEED_CATALOG !== 'false' && env.SEED_CATALOG !== '0',
    publicDir: path.join(root, 'public')
  };
}

module.exports = { loadConfig };