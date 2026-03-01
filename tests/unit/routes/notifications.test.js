'use strict';

const { mockPool } = require('../../helpers/mockDb');
const request = require('supertest');
const app = require('../../../src/app');
const { getAuthenticatedAgent } = require('../../helpers/testApp');

describe('Notification Routes', () => {
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

  describe('GET /api/notifications', () => {
    test('requires authentication', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
    });

    test('returns notifications', async () => {
      mockPool.execute.mockResolvedValueOnce([
        [{ id: 1, type: 'info', title: 'Test', message: 'Msg', is_read: false }], [],
      ]);
      const res = await authAgent.get('/api/notifications');
      expect(res.status).toBe(200);
      expect(res.body.notifications).toBeDefined();
    });
  });

  describe('PUT /api/notifications/:id/read', () => {
    test('marks notification as read', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      const res = await authAgent.put('/api/notifications/1/read')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelesen');
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    test('marks all as read', async () => {
      mockPool.execute.mockResolvedValueOnce([{ affectedRows: 5 }, []]);
      const res = await authAgent.put('/api/notifications/read-all')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelesen');
    });
  });

  describe('GET /api/notifications/settings', () => {
    test('returns default settings when none exist', async () => {
      mockPool.execute.mockResolvedValueOnce([[], []]);
      const res = await authAgent.get('/api/notifications/settings');
      expect(res.status).toBe(200);
      expect(res.body.settings.email_enabled).toBe(true);
    });
  });

  describe('PUT /api/notifications/settings', () => {
    test('updates settings', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []]) // no existing
        .mockResolvedValueOnce([{ insertId: 1 }, []]); // insert
      const res = await authAgent.put('/api/notifications/settings')
        .set('X-CSRF-Token', csrfToken)
        .send({ email_enabled: false, push_enabled: true, dashboard_enabled: true });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gespeichert');
    });
  });
});
