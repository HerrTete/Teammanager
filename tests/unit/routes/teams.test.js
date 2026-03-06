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

    test('creates team with valid data', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])                  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])   // requireRole
        .mockResolvedValueOnce([[{ id: 1 }], []])                  // sport exists in club
        .mockResolvedValueOnce([{ insertId: 1 }, []]);             // INSERT team
      const res = await authAgent.post('/api/clubs/1/sports/1/teams')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'B-Jugend' });
      expect(res.status).toBe(201);
      expect(res.body.teamId).toBe(1);
    });

    test('validates name required', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])                  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []]); // requireRole
      const res = await authAgent.post('/api/clubs/1/sports/1/teams')
        .set('X-CSRF-Token', csrfToken)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Teamname');
    });

    test('returns 404 when sport not in club', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])                  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])   // requireRole
        .mockResolvedValueOnce([[], []]);                          // sport NOT found
      const res = await authAgent.post('/api/clubs/1/sports/99/teams')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'B-Jugend' });
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Sportart');
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

    test('returns 404 for non-existent team', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])                  // requireClubAccess: club_members
        .mockResolvedValueOnce([[], []]);                          // team query returns empty
      const res = await authAgent.get('/api/clubs/1/sports/1/teams/999');
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Team nicht gefunden');
    });
  });

  describe('PUT /api/clubs/:clubId/sports/:sportId/teams/:teamId', () => {
    test('updates team name successfully', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])                  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])   // requireRole
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]);         // UPDATE teams
      const res = await authAgent.put('/api/clubs/1/sports/1/teams/1')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'C-Jugend' });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('aktualisiert');
    });

    test('requires name', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])                  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []]); // requireRole
      const res = await authAgent.put('/api/clubs/1/sports/1/teams/1')
        .set('X-CSRF-Token', csrfToken)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Teamname');
    });

    test('returns 404 for non-existent team', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])                  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])   // requireRole
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]);         // UPDATE returns 0
      const res = await authAgent.put('/api/clubs/1/sports/1/teams/999')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'C-Jugend' });
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Team nicht gefunden');
    });
  });

  describe('POST /api/clubs/:clubId/sports/:sportId/teams/:teamId/trainers', () => {
    test('requires authentication', async () => {
      const res = await request(app).post('/api/clubs/1/sports/1/teams/1/trainers');
      expect(res.status).toBe(401);
    });

    test('adds trainer successfully', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])                  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])   // requireRole
        .mockResolvedValueOnce([{ insertId: 1 }, []])              // INSERT team_trainers
        .mockResolvedValueOnce([[], []])                           // check existing Trainer role
        .mockResolvedValueOnce([{ insertId: 1 }, []]);             // INSERT user_roles
      const res = await authAgent.post('/api/clubs/1/sports/1/teams/1/trainers')
        .set('X-CSRF-Token', csrfToken)
        .send({ userId: 5 });
      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Trainer hinzugefügt');
    });

    test('validates userId required', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])                  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []]); // requireRole
      const res = await authAgent.post('/api/clubs/1/sports/1/teams/1/trainers')
        .set('X-CSRF-Token', csrfToken)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Benutzer-ID');
    });
  });

  describe('DELETE /api/clubs/:clubId/sports/:sportId/teams/:teamId/trainers/:userId', () => {
    test('removes trainer successfully', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])                  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])   // requireRole
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]);         // DELETE
      const res = await authAgent.delete('/api/clubs/1/sports/1/teams/1/trainers/5')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Trainer entfernt');
    });

    test('returns 404 when trainer not found', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])                  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])   // requireRole
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]);         // DELETE returns 0
      const res = await authAgent.delete('/api/clubs/1/sports/1/teams/1/trainers/999')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Trainer nicht gefunden');
    });
  });

  describe('POST /api/clubs/:clubId/sports/:sportId/teams/:teamId/players', () => {
    test('requires authentication', async () => {
      const res = await request(app).post('/api/clubs/1/sports/1/teams/1/players');
      expect(res.status).toBe(401);
    });

    test('adds player successfully', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])                  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])   // requireRole
        .mockResolvedValueOnce([{ insertId: 1 }, []]);             // INSERT players
      const res = await authAgent.post('/api/clubs/1/sports/1/teams/1/players')
        .set('X-CSRF-Token', csrfToken)
        .send({ userId: 10, jerseyNumber: 7 });
      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Spieler hinzugefügt');
    });
  });

  describe('DELETE /api/clubs/:clubId/sports/:sportId/teams/:teamId/players/:playerId', () => {
    test('requires authentication', async () => {
      const res = await request(app).delete('/api/clubs/1/sports/1/teams/1/players/1');
      expect(res.status).toBe(401);
    });

    test('removes player successfully', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])                  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])   // requireRole
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]);         // DELETE
      const res = await authAgent.delete('/api/clubs/1/sports/1/teams/1/players/1')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Spieler entfernt');
    });

    test('returns 404 when player not found', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])                  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])   // requireRole
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]);         // DELETE returns 0
      const res = await authAgent.delete('/api/clubs/1/sports/1/teams/1/players/999')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Spieler nicht gefunden');
    });
  });
});
