'use strict';

const { mockPool } = require('../../helpers/mockDb');
const request = require('supertest');
const app = require('../../../src/app');
const { getAuthenticatedAgent } = require('../../helpers/testApp');

describe('Game Routes', () => {
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

  describe('GET /api/clubs/:clubId/teams/:teamId/games', () => {
    test('requires authentication', async () => {
      const res = await request(app).get('/api/clubs/1/teams/1/games');
      expect(res.status).toBe(401);
    });

    test('returns games for club member', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ id: 1 }], []])   // verifyTeamBelongsToClub
        .mockResolvedValueOnce([[{ id: 1, title: 'Testspiel', date: '2024-06-01' }], []]); // SELECT games
      const res = await authAgent.get('/api/clubs/1/teams/1/games');
      expect(res.status).toBe(200);
      expect(res.body.games).toBeDefined();
    });
  });

  describe('POST /api/clubs/:clubId/teams/:teamId/games', () => {
    test('requires Trainer role and validates title', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []]);
      const res = await authAgent.post('/api/clubs/1/teams/1/games')
        .set('X-CSRF-Token', csrfToken).send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Titel');
    });

    test('creates game with valid data', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])  // requireRole
        .mockResolvedValueOnce([[{ id: 1 }], []])  // verifyTeamBelongsToClub
        .mockResolvedValueOnce([{ insertId: 1 }, []]); // INSERT
      const res = await authAgent.post('/api/clubs/1/teams/1/games')
        .set('X-CSRF-Token', csrfToken)
        .send({ title: 'Testspiel', date: '2024-06-01', opponent: 'FC Gegner' });
      expect(res.status).toBe(201);
      expect(res.body.gameId).toBe(1);
    });
  });

  describe('PUT /api/clubs/:clubId/teams/:teamId/games/:gameId', () => {
    test('requires authentication', async () => {
      const res = await request(app).put('/api/clubs/1/teams/1/games/1');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/clubs/:clubId/teams/:teamId/games/:gameId/result', () => {
    test('requires authentication', async () => {
      const res = await request(app).put('/api/clubs/1/teams/1/games/1/result');
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/clubs/:clubId/teams/:teamId/games/:gameId', () => {
    test('requires authentication', async () => {
      const res = await request(app).delete('/api/clubs/1/teams/1/games/1');
      expect(res.status).toBe(401);
    });
  });
});
