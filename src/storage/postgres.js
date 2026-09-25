'use strict';

const { Pool } = require('pg');

class PostgresStore {
  constructor(connectionString) {
    this.pool = new Pool({ connectionString, max: 10 });
    this.initialized = false;
  }

  async initialize() {
    await this.pool.query(
      'CREATE TABLE IF NOT EXISTS ghalishop_store (key text PRIMARY KEY, value jsonb NOT NULL)'
    );
    this.initialized = true;
  }

  async get(key) {
    const { rows } = await this.pool.query(
      'SELECT value FROM ghalishop_store WHERE key = $1',
      [key]
    );
    return rows.length ? rows[0].value : null;
  }

  async set(key, value) {
    await this.pool.query(
      `INSERT INTO ghalishop_store (key, value)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(value)]
    );
  }
}

module.exports = PostgresStore;