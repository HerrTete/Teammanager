'use strict';

const { mockPool } = require('../../helpers/mockDb');
const request = require('supertest');
const app = require('../../../src/app');
const { getAuthenticatedAgent } = require('../../helpers/testApp');

describe('Sport Routes', () => {
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

  describe('GET /api/clubs/:clubId/sports', () => {
    test('requires authentication', async () => {
      const res = await request(app).get('/api/clubs/1/sports');
      expect(res.status).toBe(401);
    });

    test('returns sports for club member', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []]) // not PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []]) // club member
        .mockResolvedValueOnce([[{ id: 1, name: 'Fußball', created_at: '2024-01-01' }], []]);
      const res = await authAgent.get('/api/clubs/1/sports');
      expect(res.status).toBe(200);
      expect(res.body.sports).toBeDefined();
    });
  });

  describe('POST /api/clubs/:clubId/sports', () => {
    test('requires VereinsAdmin role', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []]) // not PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []]) // club member
        .mockResolvedValueOnce([[{ role: 'Spieler' }], []]); // wrong role
      const res = await authAgent.post('/api/clubs/1/sports')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Tennis' });
      expect(res.status).toBe(403);
    });

    test('validates name is required', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []]) // not PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []]) // club member
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []]); // has role
      const res = await authAgent.post('/api/clubs/1/sports')
        .set('X-CSRF-Token', csrfToken).send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('erforderlich');
    });

    test('creates sport with VereinsAdmin role', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []]) // PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []]) // club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []]) // requireRole
        .mockResolvedValueOnce([{ insertId: 1 }, []]); // INSERT
      const res = await authAgent.post('/api/clubs/1/sports')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Tennis' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ok');
      expect(res.body.sportId).toBe(1);
    });
  });

  describe('PUT /api/clubs/:clubId/sports/:sportId', () => {
    test('validates name', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []]);
      const res = await authAgent.put('/api/clubs/1/sports/1')
        .set('X-CSRF-Token', csrfToken).send({ name: '' });
      expect(res.status).toBe(400);
    });

    test('updates sport name successfully', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []]) // PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []]) // club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []]) // requireRole
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE
      const res = await authAgent.put('/api/clubs/1/sports/1')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Basketball' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.message).toContain('aktualisiert');
    });

    test('returns 404 for non-existent sport', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []]) // PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []]) // club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []]) // requireRole
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]); // UPDATE no match
      const res = await authAgent.put('/api/clubs/1/sports/999')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Basketball' });
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('nicht gefunden');
    });
  });

  describe('DELETE /api/clubs/:clubId/sports/:sportId', () => {
    test('requires authentication', async () => {
      const res = await request(app).delete('/api/clubs/1/sports/1');
      expect(res.status).toBe(401);
    });

    test('deletes sport successfully', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []]) // PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []]) // club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []]) // requireRole
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]); // DELETE
      const res = await authAgent.delete('/api/clubs/1/sports/1')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.message).toContain('gelöscht');
    });

    test('returns 404 for non-existent sport', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []]) // PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []]) // club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []]) // requireRole
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]); // DELETE no match
      const res = await authAgent.delete('/api/clubs/1/sports/999')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('nicht gefunden');
    });
  });
});
