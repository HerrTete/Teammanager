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

    test('returns 403 when team does not belong to club', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[], []]);           // verifyTeamBelongsToClub: no match
      const res = await authAgent.get('/api/clubs/1/teams/999/games');
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Team gehört nicht');
    });
  });

  describe('GET /api/clubs/:clubId/teams/:teamId/games/:gameId', () => {
    test('requires authentication', async () => {
      const res = await request(app).get('/api/clubs/1/teams/1/games/1');
      expect(res.status).toBe(401);
    });

    test('returns game details with venue fields', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{
          id: 1, title: 'Testspiel', date: '2024-06-01', kickoff_time: '15:00',
          meeting_time: '14:00', info: 'Testinfo', opponent: 'FC Gegner',
          venue_name: 'Stadion', venue_street: 'Hauptstr.', venue_house_number: '1',
          venue_zip_code: '12345', venue_city: 'Berlin',
        }], []]);                                   // SELECT game with venue JOIN
      const res = await authAgent.get('/api/clubs/1/teams/1/games/1');
      expect(res.status).toBe(200);
      expect(res.body.game).toBeDefined();
      expect(res.body.game.venue_name).toBe('Stadion');
      expect(res.body.game.venue_street).toBe('Hauptstr.');
      expect(res.body.game.venue_house_number).toBe('1');
      expect(res.body.game.venue_zip_code).toBe('12345');
      expect(res.body.game.venue_city).toBe('Berlin');
    });

    test('returns 404 for non-existent game', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[], []]);           // SELECT game: not found
      const res = await authAgent.get('/api/clubs/1/teams/1/games/999');
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Spiel nicht gefunden');
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
        .send({ title: 'Testspiel', date: '2024-06-01', kickoff_time: '15:00', meeting_time: '14:00', opponent: 'FC Gegner' });
      expect(res.status).toBe(201);
      expect(res.body.gameId).toBe(1);
    });

    test('creates game with all new fields including info', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])  // requireRole
        .mockResolvedValueOnce([[{ id: 1 }], []])  // verifyTeamBelongsToClub
        .mockResolvedValueOnce([{ insertId: 2 }, []]); // INSERT
      const res = await authAgent.post('/api/clubs/1/teams/1/games')
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'Pokalspiel',
          date: '2024-07-15',
          kickoff_time: '18:30',
          meeting_time: '17:00',
          info: 'Bitte Trikots mitbringen',
          opponent: 'SV Muster',
        });
      expect(res.status).toBe(201);
      expect(res.body.gameId).toBe(2);
    });
  });

  describe('PUT /api/clubs/:clubId/teams/:teamId/games/:gameId', () => {
    test('requires authentication', async () => {
      const res = await request(app).put('/api/clubs/1/teams/1/games/1');
      expect(res.status).toBe(401);
    });

    test('successfully updates game with new fields', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])  // requireRole
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE
      const res = await authAgent.put('/api/clubs/1/teams/1/games/1')
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'Aktualisiertes Spiel',
          date: '2024-08-01',
          kickoff_time: '16:00',
          meeting_time: '15:00',
          info: 'Geänderte Info',
          opponent: 'FC Neu',
        });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('aktualisiert');
    });

    test('returns 404 for non-existent game', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])  // requireRole
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]); // UPDATE: not found
      const res = await authAgent.put('/api/clubs/1/teams/1/games/999')
        .set('X-CSRF-Token', csrfToken)
        .send({ title: 'Nicht vorhanden', date: '2024-08-01' });
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Spiel nicht gefunden');
    });
  });

  describe('PUT /api/clubs/:clubId/teams/:teamId/games/:gameId/result', () => {
    test('requires authentication', async () => {
      const res = await request(app).put('/api/clubs/1/teams/1/games/1/result');
      expect(res.status).toBe(401);
    });

    test('updates result markdown', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])  // requireRole
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]); // UPDATE result
      const res = await authAgent.put('/api/clubs/1/teams/1/games/1/result')
        .set('X-CSRF-Token', csrfToken)
        .send({ result_markdown: '# Ergebnis\n2:1 gewonnen' });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Ergebnis aktualisiert');
    });

    test('returns 404 for non-existent game', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])  // requireRole
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]); // UPDATE: not found
      const res = await authAgent.put('/api/clubs/1/teams/1/games/999/result')
        .set('X-CSRF-Token', csrfToken)
        .send({ result_markdown: '# Ergebnis' });
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Spiel nicht gefunden');
    });
  });

  describe('DELETE /api/clubs/:clubId/teams/:teamId/games/:gameId', () => {
    test('requires authentication', async () => {
      const res = await request(app).delete('/api/clubs/1/teams/1/games/1');
      expect(res.status).toBe(401);
    });

    test('successfully deletes game', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])  // requireRole
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]); // DELETE
      const res = await authAgent.delete('/api/clubs/1/teams/1/games/1')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelöscht');
    });

    test('returns 404 for non-existent game', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])          // requireClubAccess: PortalAdmin check
        .mockResolvedValueOnce([[{ id: 1 }], []])  // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])  // requireRole
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]); // DELETE: not found
      const res = await authAgent.delete('/api/clubs/1/teams/1/games/999')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Spiel nicht gefunden');
    });
  });
});
