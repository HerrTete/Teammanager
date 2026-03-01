'use strict';

const { mockPool } = require('../../helpers/mockDb');
const request = require('supertest');
const app = require('../../../src/app');

describe('Health Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.getConnection.mockResolvedValue({
      execute: jest.fn().mockResolvedValue([[], []]),
      release: jest.fn(),
      ping: jest.fn().mockResolvedValue(true),
    });
  });

  test('GET /api/health returns {status: ok}', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('GET /api/db-status returns ok when DB is connected', async () => {
    const res = await request(app).get('/api/db-status');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/db-status returns 500 when DB fails', async () => {
    mockPool.getConnection.mockRejectedValueOnce(new Error('Connection refused'));
    const res = await request(app).get('/api/db-status');
    expect(res.status).toBe(500);
    expect(res.body.status).toBe('error');
  });
});
