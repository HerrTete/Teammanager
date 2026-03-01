'use strict';

const { mockPool } = require('../../helpers/mockDb');
const request = require('supertest');
const app = require('../../../src/app');
const { getAuthenticatedAgent } = require('../../helpers/testApp');

describe('Dashboard Routes', () => {
  let authAgent;

  beforeAll(async () => {
    const auth = await getAuthenticatedAgent(app);
    authAgent = auth.agent;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.execute.mockResolvedValue([[], []]);
    mockPool.getConnection.mockResolvedValue({
      execute: jest.fn().mockResolvedValue([[], []]),
      release: jest.fn(),
    });
  });

  describe('GET /api/dashboard', () => {
    test('requires authentication', async () => {
      const res = await request(app).get('/api/dashboard');
      expect(res.status).toBe(401);
    });

    test('returns dashboard data', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []]) // admin check
        .mockResolvedValueOnce([[{ id: 1, name: 'FC Test' }], []]) // clubs
        .mockResolvedValueOnce([[{ count: 3 }], []]) // notif count
        .mockResolvedValueOnce([[], []]) // games
        .mockResolvedValueOnce([[], []]); // trainings
      const res = await authAgent.get('/api/dashboard');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.clubs).toBeDefined();
      expect(res.body.unreadNotifications).toBeDefined();
      expect(res.body.upcomingEvents).toBeDefined();
    });
  });
});
