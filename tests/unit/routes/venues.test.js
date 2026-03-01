'use strict';

const { mockPool } = require('../../helpers/mockDb');
const request = require('supertest');
const app = require('../../../src/app');
const { getAuthenticatedAgent } = require('../../helpers/testApp');

describe('Venue Routes', () => {
  let authAgent, csrfToken;

  beforeAll(async () => {
    const auth = await getAuthenticatedAgent(app);
    authAgent = auth.agent;
    csrfToken = auth.csrfToken;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.execute.mockResolvedValue([[], []]);
    mockPool.getConnection.mockResolvedValue({
      execute: jest.fn().mockResolvedValue([[], []]),
      release: jest.fn(),
    });
  });

  describe('GET /api/clubs/:clubId/venues', () => {
    test('requires authentication', async () => {
      const res = await request(app).get('/api/clubs/1/venues');
      expect(res.status).toBe(401);
    });

    test('returns venues for club member', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ id: 1, name: 'Stadion', address: 'Str. 1' }], []]);
      const res = await authAgent.get('/api/clubs/1/venues');
      expect(res.status).toBe(200);
      expect(res.body.venues).toBeDefined();
    });
  });

  describe('POST /api/clubs/:clubId/venues', () => {
    test('validates required name field', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []]);
      const res = await authAgent.post('/api/clubs/1/venues')
        .set('X-CSRF-Token', csrfToken).send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('erforderlich');
    });

    test('creates venue with valid data', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])
        .mockResolvedValueOnce([{ insertId: 1 }, []]);
      const res = await authAgent.post('/api/clubs/1/venues')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Stadion', address: 'Str. 1' });
      expect(res.status).toBe(201);
      expect(res.body.venueId).toBe(1);
    });
  });

  describe('PUT /api/clubs/:clubId/venues/:venueId', () => {
    test('validates name is required', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []]);
      const res = await authAgent.put('/api/clubs/1/venues/1')
        .set('X-CSRF-Token', csrfToken).send({ name: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/clubs/:clubId/venues/:venueId', () => {
    test('requires authentication', async () => {
      const res = await request(app).delete('/api/clubs/1/venues/1');
      expect(res.status).toBe(401);
    });
  });
});
