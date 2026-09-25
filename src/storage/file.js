'use strict';

const fs = require('node:fs');
const path = require('node:path');

class FileStore {
  constructor(directory) {
    this.directory = path.resolve(directory);
    this.initialized = false;
  }

  async initialize() {
    await fs.promises.mkdir(this.directory, { recursive: true });
    this.initialized = true;
  }

  _fileForKey(key) {
    const safe = key.replace(/[^A-Za-z0-9_.-]/g, '_');
    return path.join(this.directory, `${safe}.json`);
  }

  async get(key) {
    try {
      const raw = await fs.promises.readFile(this._fileForKey(key), 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async set(key, value) {
    const file = this._fileForKey(key);
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.promises.mkdir(this.directory, { recursive: true });
    await fs.promises.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
    await fs.promises.rename(tmp, file);
  }
}

module.exports = FileStore;