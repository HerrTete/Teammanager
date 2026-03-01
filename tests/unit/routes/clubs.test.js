'use strict';

const { mockPool } = require('../../helpers/mockDb');
const request = require('supertest');
const app = require('../../../src/app');
const { getAuthenticatedAgent } = require('../../helpers/testApp');

describe('Club Routes', () => {
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

  describe('GET /api/clubs', () => {
    test('requires authentication', async () => {
      const res = await request(app).get('/api/clubs');
      expect(res.status).toBe(401);
    });

    test('returns clubs for authenticated user', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []]) // not PortalAdmin
        .mockResolvedValueOnce([[{ id: 1, name: 'FC Test', created_at: '2024-01-01' }], []]);
      const res = await authAgent.get('/api/clubs');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.clubs).toHaveLength(1);
    });
  });

  describe('POST /api/clubs', () => {
    test('requires PortalAdmin role', async () => {
      mockPool.execute.mockResolvedValueOnce([[{ role: 'Vereinsmitglied' }], []]);
      const res = await authAgent.post('/api/clubs')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Neuer Verein' });
      expect(res.status).toBe(403);
    });

    test('creates club with PortalAdmin role', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ role: 'PortalAdmin' }], []]) // requireRole
        .mockResolvedValueOnce([{ insertId: 1 }, []]); // INSERT
      const res = await authAgent.post('/api/clubs')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Neuer Verein' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('GET /api/clubs/:clubId', () => {
    test('requires authentication', async () => {
      const res = await request(app).get('/api/clubs/1');
      expect(res.status).toBe(401);
    });

    test('returns club for member', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []]) // not PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []]) // club member
        .mockResolvedValueOnce([[{ id: 1, name: 'FC Test', created_at: '2024-01-01' }], []]);
      const res = await authAgent.get('/api/clubs/1');
      expect(res.status).toBe(200);
      expect(res.body.club).toBeDefined();
    });
  });

  describe('PUT /api/clubs/:clubId', () => {
    test('requires authentication', async () => {
      const res = await request(app).put('/api/clubs/1').send({ name: 'X' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/clubs/:clubId/logo', () => {
    test('requires authentication', async () => {
      const res = await request(app).post('/api/clubs/1/logo');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/clubs/:clubId/logo', () => {
    test('returns 404 when no logo', async () => {
      mockPool.execute.mockResolvedValueOnce([[], []]);
      const res = await request(app).get('/api/clubs/1/logo');
      expect(res.status).toBe(404);
    });

    test('returns logo data', async () => {
      const logoBuffer = Buffer.from('fake-png');
      mockPool.execute.mockResolvedValueOnce([[{ logo: logoBuffer, logo_mime: 'image/png' }], []]);
      const res = await request(app).get('/api/clubs/1/logo');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/png');
    });
  });
});
