'use strict';

const { mockPool } = require('../../helpers/mockDb');
const request = require('supertest');
const app = require('../../../src/app');
const { getAuthenticatedAgent } = require('../../helpers/testApp');

describe('Team Routes', () => {
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

  describe('GET /api/clubs/:clubId/sports/:sportId/teams', () => {
    test('requires authentication', async () => {
      const res = await request(app).get('/api/clubs/1/sports/1/teams');
      expect(res.status).toBe(401);
    });

    test('returns teams for club member', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ id: 1, name: 'A-Jugend', created_at: '2024-01-01' }], []]);
      const res = await authAgent.get('/api/clubs/1/sports/1/teams');
      expect(res.status).toBe(200);
      expect(res.body.teams).toBeDefined();
    });
  });

  describe('POST /api/clubs/:clubId/sports/:sportId/teams', () => {
    test('requires VereinsAdmin role', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'Spieler' }], []]);
      const res = await authAgent.post('/api/clubs/1/sports/1/teams')
        .set('X-CSRF-Token', csrfToken).send({ name: 'B-Jugend' });
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/clubs/:clubId/sports/:sportId/teams/:teamId', () => {
    test('returns team details', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ id: 1, name: 'A-Jugend', created_at: '2024-01-01' }], []])
        .mockResolvedValueOnce([[], []]) // trainers
        .mockResolvedValueOnce([[], []]); // players
      const res = await authAgent.get('/api/clubs/1/sports/1/teams/1');
      expect(res.status).toBe(200);
      expect(res.body.team).toBeDefined();
    });
  });

  describe('POST /api/clubs/:clubId/sports/:sportId/teams/:teamId/trainers', () => {
    test('requires authentication', async () => {
      const res = await request(app).post('/api/clubs/1/sports/1/teams/1/trainers');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/clubs/:clubId/sports/:sportId/teams/:teamId/players', () => {
    test('requires authentication', async () => {
      const res = await request(app).post('/api/clubs/1/sports/1/teams/1/players');
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/clubs/:clubId/sports/:sportId/teams/:teamId/players/:playerId', () => {
    test('requires authentication', async () => {
      const res = await request(app).delete('/api/clubs/1/sports/1/teams/1/players/1');
      expect(res.status).toBe(401);
    });
  });
});
