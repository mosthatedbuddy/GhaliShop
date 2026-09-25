'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SEED_MARKER_KEY = '_ghalishop_seed_v1';

function loadSeedCatalog(root) {
  const file = path.join(root, 'data', 'seed-products.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function ensureSeeded(store, config) {
  if (!config.seedCatalog) return false;
  const marker = await store.get(SEED_MARKER_KEY);
  if (marker !== null) return false;
  const current = await store.get('products');
  const catalog = loadSeedCatalog(config.root);
  if (catalog.length && (current === null || (Array.isArray(current) && current.length === 0))) {
    await store.set('products', catalog);
  }
  await store.set(SEED_MARKER_KEY, '1');
  return true;
}

module.exports = { ensureSeeded, loadSeedCatalog };