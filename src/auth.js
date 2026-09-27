'use strict';

const crypto = require('node:crypto');

function createAuth(config) {
  // Serverless platforms run many instances; a per-instance random secret would
  // invalidate admin tokens between requests, so fall back to a deterministic one.
  const secret =
    config.sessionSecret ||
    crypto.createHash('sha256').update(`ghalishop-session:${config.adminPassword}`).digest('hex');

  function sign(value) {
    return crypto.createHmac('sha256', secret).update(`ghalishop:${value}`).digest('hex');
  }

  function createToken() {
    const expiresAt = Date.now() + config.sessionMinutes * 60 * 1000;
    const random = crypto.randomBytes(16).toString('hex');
    const payload = `${expiresAt}.${random}`;
    return `${payload}.${sign(payload)}`;
  }

  function isAuthenticated(request) {
    const header = request.get('authorization') || '';
    if (!header.startsWith('Bearer ')) return false;
    const parts = header.slice(7).split('.');
    if (parts.length !== 3) return false;
    const expiresAt = Number(parts[0]);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
    const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`));
    const received = Buffer.from(parts[2]);
    if (expected.length !== received.length) return false;
    return crypto.timingSafeEqual(expected, received);
  }

  return { createToken, isAuthenticated };
}

module.exports = { createAuth };
