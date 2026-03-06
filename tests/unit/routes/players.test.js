'use strict';

const { mockPool } = require('../../helpers/mockDb');
const request = require('supertest');
const app = require('../../../src/app');
const { getAuthenticatedAgent } = require('../../helpers/testApp');

describe('Player Routes', () => {
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

  describe('GET /api/clubs/:clubId/teams/:teamId/players', () => {
    test('requires authentication', async () => {
      const res = await request(app).get('/api/clubs/1/teams/1/players');
      expect(res.status).toBe(401);
    });

    test('returns players with managed_by info', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ id: 1 }], []])   // verifyTeamBelongsToClub
        .mockResolvedValueOnce([[{
          id: 1, user_id: null, name: 'Max Mustermann', jersey_number: 10,
          managed_by: 2, created_at: '2024-01-01', username: null,
          managed_by_username: 'trainer1',
        }], []]);                                   // SELECT players
      const res = await authAgent.get('/api/clubs/1/teams/1/players');
      expect(res.status).toBe(200);
      expect(res.body.players).toBeDefined();
      expect(res.body.players[0].name).toBe('Max Mustermann');
      expect(res.body.players[0].managed_by_username).toBe('trainer1');
    });

    test('returns 403 when team does not belong to club', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[], []]);           // verifyTeamBelongsToClub: no match
      const res = await authAgent.get('/api/clubs/1/teams/999/players');
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Team gehört nicht');
    });
  });

  describe('POST /api/clubs/:clubId/teams/:teamId/players', () => {
    test('requires authentication', async () => {
      const res = await request(app).post('/api/clubs/1/teams/1/players');
      expect(res.status).toBe(401);
    });

    test('creates player with userId', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])  // requireRole
        .mockResolvedValueOnce([{ insertId: 1 }, []]); // INSERT
      const res = await authAgent.post('/api/clubs/1/teams/1/players')
        .set('X-CSRF-Token', csrfToken)
        .send({ userId: 5, jerseyNumber: 9 });
      expect(res.status).toBe(201);
      expect(res.body.playerId).toBe(1);
    });

    test('creates managed player with name and managedBy', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])  // requireRole
        .mockResolvedValueOnce([{ insertId: 2 }, []]); // INSERT
      const res = await authAgent.post('/api/clubs/1/teams/1/players')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Kind Spieler', managedBy: 3, jerseyNumber: 7 });
      expect(res.status).toBe(201);
      expect(res.body.playerId).toBe(2);
    });

    test('rejects both userId and name', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []]); // requireRole
      const res = await authAgent.post('/api/clubs/1/teams/1/players')
        .set('X-CSRF-Token', csrfToken)
        .send({ userId: 5, name: 'Max Mustermann' });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('nicht beides');
    });

    test('rejects missing userId and name', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []]); // requireRole
      const res = await authAgent.post('/api/clubs/1/teams/1/players')
        .set('X-CSRF-Token', csrfToken)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('erforderlich');
    });

    test('rejects name without managedBy', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []]); // requireRole
      const res = await authAgent.post('/api/clubs/1/teams/1/players')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Kind Spieler' });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Verwaltender Benutzer');
    });
  });

  describe('PUT /api/clubs/:clubId/teams/:teamId/players/:playerId', () => {
    test('requires authentication', async () => {
      const res = await request(app).put('/api/clubs/1/teams/1/players/1');
      expect(res.status).toBe(401);
    });

    test('updates player jersey number, name, managedBy', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])  // requireRole
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE
      const res = await authAgent.put('/api/clubs/1/teams/1/players/1')
        .set('X-CSRF-Token', csrfToken)
        .send({ jerseyNumber: 10, name: 'Neuer Name', managedBy: 3 });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('aktualisiert');
    });

    test('returns 404 for non-existent player', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])  // requireRole
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]); // UPDATE: not found
      const res = await authAgent.put('/api/clubs/1/teams/1/players/999')
        .set('X-CSRF-Token', csrfToken)
        .send({ jerseyNumber: 10 });
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('nicht gefunden');
    });
  });

  describe('DELETE /api/clubs/:clubId/teams/:teamId/players/:playerId', () => {
    test('requires authentication', async () => {
      const res = await request(app).delete('/api/clubs/1/teams/1/players/1');
      expect(res.status).toBe(401);
    });

    test('deletes player successfully', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])  // requireRole
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]); // DELETE
      const res = await authAgent.delete('/api/clubs/1/teams/1/players/1')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('entfernt');
    });

    test('returns 404 for non-existent player', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])  // requireRole
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]); // DELETE: not found
      const res = await authAgent.delete('/api/clubs/1/teams/1/players/999')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('nicht gefunden');
    });
  });
});
