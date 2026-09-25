'use strict';

const express = require('express');
const { ensureSeeded } = require('../seed');

const PRODUCTS_KEY = 'products';
const ORDERS_KEY = 'orders';
const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function createApiRouter({ config, store, auth }) {
  const router = express.Router();
  const loginAttempts = new Map();

  router.use((req, res, next) => {
    const origin = req.get('origin');
    if (config.corsAllowedOrigins.length) {
      if (config.corsAllowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Vary', 'Origin');
    next();
  });

  router.options('*', (req, res) => res.sendStatus(204));

  router.get('/health', (req, res) => {
    res.json({ ok: true, storage: config.storageDriver });
  });

  router.post('/admin/login', (req, res) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    let record = loginAttempts.get(ip) || { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    if (record.resetAt <= now) record = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    record.count += 1;
    loginAttempts.set(ip, record);

    if (record.count > LOGIN_MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many login attempts. Try again in a minute.' });
    }
    if ((req.body && req.body.password) !== config.adminPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    record.count = 0;
    return res.json({ token: auth.createToken() });
  });

  router.get('/products', async (req, res, next) => {
    try {
      await ensureSeeded(store, config);
      const products = await store.get(PRODUCTS_KEY);
      res.json(Array.isArray(products) ? products : []);
    } catch (error) {
      next(error);
    }
  });

  router.post('/orders', async (req, res, next) => {
    try {
      const order = normalizeOrder(req.body);
      const orders = await store.get(ORDERS_KEY);
      const list = Array.isArray(orders) ? orders : [];
      list.unshift(order);
      await store.set(ORDERS_KEY, list);
      res.status(201).json(order);
    } catch (error) {
      next(error);
    }
  });

  router.use((req, res, next) => {
    if (!auth.isAuthenticated(req)) {
      return res.status(401).json({ error: 'Admin authentication required' });
    }
    next();
  });

  router.put('/products', async (req, res, next) => {
    try {
      const products = req.body;
      if (!Array.isArray(products)) {
        return res.status(400).json({ error: 'Products must be an array' });
      }
      await store.set(PRODUCTS_KEY, products);
      res.json(products);
    } catch (error) {
      next(error);
    }
  });

  router.get('/orders', async (req, res, next) => {
    try {
      const orders = await store.get(ORDERS_KEY);
      res.json(Array.isArray(orders) ? orders : []);
    } catch (error) {
      next(error);
    }
  });

  router.put('/orders', async (req, res, next) => {
    try {
      const orders = req.body;
      if (!Array.isArray(orders)) {
        return res.status(400).json({ error: 'Orders must be an array' });
      }
      await store.set(ORDERS_KEY, orders);
      res.json(orders);
    } catch (error) {
      next(error);
    }
  });

  router.use((req, res) => res.status(404).json({ error: 'Not found' }));

  return router;
}

function normalizeOrder(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const customer = source.customer && typeof source.customer === 'object' ? source.customer : {};
  return {
    id: String(source.id || `GS-${Date.now().toString(36).toUpperCase()}`),
    createdAt: source.createdAt || new Date().toISOString(),
    status: String(source.status || 'New'),
    customer: {
      name: String(customer.name || '').trim(),
      phone: String(customer.phone || '').trim(),
      city: String(customer.city || '').trim(),
      address: String(customer.address || '').trim(),
      notes: String(customer.notes || '').trim()
    },
    items: Array.isArray(source.items)
      ? source.items
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            id: String(item.id || ''),
            name: String(item.name || ''),
            price: Number(item.price) || 0,
            quantity: Math.max(1, Number(item.quantity) || 1)
          }))
      : [],
    total: Number(source.total) || 0
  };
}

module.exports = { createApiRouter };