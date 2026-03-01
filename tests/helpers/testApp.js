'use strict';

const { mockPool } = require('./mockDb');
const request = require('supertest');

function createTestApp() {
  return require('../../src/app');
}

async function getAuthenticatedAgent(app, opts = {}) {
  const agent = request.agent(app);
  const csrfRes = await agent.get('/api/auth/csrf-token');
  const csrfToken = csrfRes.body.csrfToken;

  const userId = opts.userId || 1;
  const username = opts.username || 'testuser';

  const bcrypt = require('bcrypt');
  const hash = await bcrypt.hash('Test1234!', 4);

  // Set dummy hash for auth module
  const authModule = require('../../src/routes/auth');
  if (authModule.setDummyHash) authModule.setDummyHash(hash);

  const connMock = {
    execute: jest.fn()
      .mockResolvedValueOnce([[{ id: userId, username, password_hash: hash }], []])
      .mockResolvedValueOnce([[], []]),
    release: jest.fn(),
  };
  mockPool.getConnection.mockResolvedValueOnce(connMock);

  const loginRes = await agent
    .post('/api/auth/login')
    .set('X-CSRF-Token', csrfToken)
    .send({ username, password: 'Test1234!' });

  const newCsrfToken = loginRes.body.csrfToken || csrfToken;

  return { agent, csrfToken: newCsrfToken, userId, username };
}

module.exports = { createTestApp, getAuthenticatedAgent, mockPool };
