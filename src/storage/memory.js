'use strict';

class MemoryStore {
  constructor() {
    this.data = new Map();
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
  }

  async get(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  async set(key, value) {
    this.data.set(key, value);
  }
}

module.exports = MemoryStore;