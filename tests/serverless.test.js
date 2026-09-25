'use strict';

const assert = require('node:assert');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 39292;
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_PASSWORD = 'serverless-test-pwd';

const bootstrap = `
  process.env.STORAGE_DRIVER = 'memory';
  process.env.ADMIN_PASSWORD = ${JSON.stringify(ADMIN_PASSWORD)};
  process.env.SESSION_SECRET = 'serverless-test-secret';
  process.env.SEED_CATALOG = 'true';
  const http = require('node:http');
  const handler = require(${JSON.stringify(path.join(ROOT, 'api', 'index.js'))});
  http.createServer((req, res) => handler(req, res)).listen(${PORT}, () => {
    console.log('serverless-up');
  });
`;

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
    await sleep(250);
  }
  throw new Error('serverless test server did not start');
}

async function request(url, options = {}) {
  return fetch(`${BASE}${url}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
}

(async () => {
  const child = spawn(process.execPath, ['-e', bootstrap], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stderr.on('data', (data) => process.stderr.write(data));

  try {
    await waitForServer(child);

    let res = await request('/api/products');
    assert.strictEqual(res.status, 200);
    const products = await res.json();
    assert.ok(Array.isArray(products) && products.length === 15, 'serverless + memory seeds 15 products');

    res = await request('/api/orders');
    assert.strictEqual(res.status, 401, 'admin endpoint guarded');

    res = await request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password: ADMIN_PASSWORD })
    });
    assert.strictEqual(res.status, 200, 'serverless login');
    const { token } = await res.json();
    const headers = { Authorization: `Bearer ${token}` };

    res = await request('/api/products', {
      method: 'PUT',
      headers,
      body: JSON.stringify([{ id: 'sl-1', name: 'Serverless bag', price: 99 }])
    });
    assert.strictEqual(res.status, 200, 'serverless PUT products');

    res = await request('/api/products');
    const updated = await res.json();
    assert.strictEqual(updated.length, 1, 'memory store reflects admin update');

    res = await request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ customer: { name: 'Serverless Customer', phone: '0611111111', city: 'Fes', address: 'x' }, items: [], total: 99 })
    });
    assert.strictEqual(res.status, 201, 'serverless order POST');

    res = await request('/api/orders', { headers });
    const orders = await res.json();
    assert.strictEqual(orders.length, 1, 'order visible to admin');

    console.log('Serverless wrapper + memory driver tests passed ✓');
  } finally {
    child.kill();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});