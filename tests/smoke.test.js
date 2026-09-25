'use strict';

const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 39291;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ghalishop-test-'));
const ADMIN_PASSWORD = 'test-password-123';

function request(url, options = {}) {
  return fetch(`${BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(child) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${child.exitCode}`);
    }
    await sleep(250);
  }
  throw new Error('server did not start in time');
}

(async () => {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      STORAGE_DIR: DATA_DIR,
      ADMIN_PASSWORD,
      SESSION_SECRET: 'test-secret',
      SEED_CATALOG: 'true'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', (data) => process.stderr.write(data));

  try {
    await waitForServer(child);

    let res = await request('/api/health');
    assert.strictEqual(res.status, 200, 'health endpoint');

    res = await request('/api/products');
    assert.strictEqual(res.status, 200, 'products GET');
    let products = await res.json();
    assert.ok(Array.isArray(products) && products.length > 0, 'catalog should be seeded');

    res = await request('/api/orders');
    assert.strictEqual(res.status, 401, 'orders without token must be 401');

    res = await request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: 'wrong-password' })
    });
    assert.strictEqual(res.status, 401, 'wrong password must 401');

    res = await request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: ADMIN_PASSWORD })
    });
    assert.strictEqual(res.status, 200, 'correct password logs in');
    const { token } = await res.json();
    assert.ok(token, 'token expected');
    const adminHeaders = { Authorization: `Bearer ${token}` };

    res = await request('/api/products', {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify([{ id: 'custom-1', name: 'Custom bag', price: 120, images: [] }])
    });
    assert.strictEqual(res.status, 200, 'admin PUT products');

    res = await request('/api/products');
    products = await res.json();
    assert.strictEqual(products.length, 1, 'catalog reflects the admin update');
    assert.strictEqual(products[0].id, 'custom-1');

    res = await request('/api/products', {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ not: 'an array' })
    });
    assert.strictEqual(res.status, 400, 'non-array products must 400');

    res = await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        customer: { name: 'Nadia', phone: '+212 612345678', city: 'Casablanca', address: '1, Rue Test', notes: 'Call before delivery' },
        items: [{ id: 'custom-1', name: 'Custom bag', price: 120, quantity: 2 }],
        total: 240
      })
    });
    assert.strictEqual(res.status, 201, 'public order POST');

    res = await request('/api/orders', { headers: adminHeaders });
    assert.strictEqual(res.status, 200, 'admin orders GET');
    let orders = await res.json();
    assert.strictEqual(orders.length, 1, 'one order stored');
    assert.strictEqual(orders[0].customer.name, 'Nadia');
    assert.strictEqual(orders[0].customer.phone, '+212 612345678');

    orders[0].status = 'Completed';
    res = await request('/api/orders', {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify(orders)
    });
    assert.strictEqual(res.status, 200, 'admin orders PUT');

    res = await fetch(`${BASE}/`);
    assert.strictEqual(res.status, 200, 'storefront HTML served');
    const html = await res.text();
    assert.ok(html.includes('GhaliShop'), 'storefront references GhaliShop');

    res = await fetch(`${BASE}/catalog.json`);
    assert.strictEqual(res.status, 200, 'static catalog snapshot served');

    res = await request('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{broken json'
    });
    assert.strictEqual(res.status, 400, 'malformed JSON body must 400');

    res = await fetch(`${BASE}/admin.html`);
    assert.strictEqual(res.status, 200, 'admin page served');

    res = await fetch(`${BASE}/checkout.html`);
    assert.strictEqual(res.status, 200, 'checkout page served');

    console.log(`Smoke tests passed ✓ (${products.length} products, ${orders.length} orders, storage=file)`);
  } finally {
    child.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});