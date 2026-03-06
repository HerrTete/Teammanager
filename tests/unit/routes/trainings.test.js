'use strict';

const { mockPool } = require('../../helpers/mockDb');
const request = require('supertest');
const app = require('../../../src/app');
const { getAuthenticatedAgent } = require('../../helpers/testApp');

describe('Training Routes', () => {
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

  describe('GET /api/clubs/:clubId/teams/:teamId/trainings', () => {
    test('requires authentication', async () => {
      const res = await request(app).get('/api/clubs/1/teams/1/trainings');
      expect(res.status).toBe(401);
    });

    test('returns trainings for club member', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ id: 1 }], []])   // verifyTeamBelongsToClub
        .mockResolvedValueOnce([[{ id: 1, title: 'Abschlusstraining' }], []]); // SELECT
      const res = await authAgent.get('/api/clubs/1/teams/1/trainings');
      expect(res.status).toBe(200);
      expect(res.body.trainings).toBeDefined();
    });

    test('returns 403 when team does not belong to club', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[], []]);            // verifyTeamBelongsToClub returns empty
      const res = await authAgent.get('/api/clubs/1/teams/999/trainings');
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Team gehört nicht');
    });
  });

  describe('POST /api/clubs/:clubId/teams/:teamId/trainings', () => {
    test('validates title is required', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []]);
      const res = await authAgent.post('/api/clubs/1/teams/1/trainings')
        .set('X-CSRF-Token', csrfToken).send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Titel');
    });

    test('creates training with valid data', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])  // requireRole
        .mockResolvedValueOnce([[{ id: 1 }], []])   // verifyTeamBelongsToClub
        .mockResolvedValueOnce([{ insertId: 1 }, []])  // INSERT training
        .mockResolvedValueOnce([{ insertId: 1 }, []]); // INSERT training_teams
      const res = await authAgent.post('/api/clubs/1/teams/1/trainings')
        .set('X-CSRF-Token', csrfToken)
        .send({ title: 'Abschlusstraining', date: '2024-06-01' });
      expect(res.status).toBe(201);
      expect(res.body.trainingId).toBe(1);
    });

    test('creates training with sport_id and additional_team_ids', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                      // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])              // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])    // requireRole
        .mockResolvedValueOnce([[{ id: 1 }], []])              // verifyTeamBelongsToClub (primary)
        .mockResolvedValueOnce([{ insertId: 1 }, []])          // INSERT training
        .mockResolvedValueOnce([{ insertId: 1 }, []])          // INSERT training_teams (primary)
        .mockResolvedValueOnce([[{ id: 2 }], []])              // verifyTeamBelongsToClub (additional team 2)
        .mockResolvedValueOnce([{ insertId: 2 }, []]);         // INSERT training_teams (team 2)
      const res = await authAgent.post('/api/clubs/1/teams/1/trainings')
        .set('X-CSRF-Token', csrfToken)
        .send({ title: 'Kombitraining', date: '2024-07-01', sport_id: 5, additional_team_ids: [2] });
      expect(res.status).toBe(201);
      expect(res.body.trainingId).toBe(1);
      expect(res.body.skippedTeamIds).toBeUndefined();
    });

    test('skips invalid teams from additional_team_ids and reports them', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                      // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])              // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])    // requireRole
        .mockResolvedValueOnce([[{ id: 1 }], []])              // verifyTeamBelongsToClub (primary)
        .mockResolvedValueOnce([{ insertId: 1 }, []])          // INSERT training
        .mockResolvedValueOnce([{ insertId: 1 }, []])          // INSERT training_teams (primary)
        .mockResolvedValueOnce([[], []]);                      // verifyTeamBelongsToClub (team 99) — invalid
      const res = await authAgent.post('/api/clubs/1/teams/1/trainings')
        .set('X-CSRF-Token', csrfToken)
        .send({ title: 'Kombitraining', additional_team_ids: [99] });
      expect(res.status).toBe(201);
      expect(res.body.trainingId).toBe(1);
      expect(res.body.skippedTeamIds).toEqual([99]);
    });
  });

  describe('GET /api/clubs/:clubId/teams/:teamId/trainings/:trainingId', () => {
    test('returns training with associated teams', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                      // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])              // requireClubAccess: club_members
        .mockResolvedValueOnce([[{
          id: 1, title: 'Abschlusstraining', date: '2024-06-01', time: '18:00',
          location_text: 'Sportplatz', venue_id: null, sport_id: 5, team_id: 1,
          venue_name: null, venue_street: null, venue_house_number: null,
          venue_zip_code: null, venue_city: null, result_markdown: null,
        }], []])                                               // SELECT training
        .mockResolvedValueOnce([[
          { team_id: 1, team_name: 'A-Team' },
          { team_id: 2, team_name: 'B-Team' },
        ], []]);                                               // SELECT training_teams
      const res = await authAgent.get('/api/clubs/1/teams/1/trainings/1');
      expect(res.status).toBe(200);
      expect(res.body.training).toBeDefined();
      expect(res.body.training.title).toBe('Abschlusstraining');
      expect(res.body.training.teams).toHaveLength(2);
      expect(res.body.training.teams[0].team_name).toBe('A-Team');
      expect(res.body.training.teams[1].team_name).toBe('B-Team');
    });

    test('returns 404 for non-existent training', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                      // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])              // requireClubAccess: club_members
        .mockResolvedValueOnce([[], []]);                      // SELECT training returns empty
      const res = await authAgent.get('/api/clubs/1/teams/1/trainings/999');
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Training nicht gefunden');
    });
  });

  describe('PUT /api/clubs/:clubId/teams/:teamId/trainings/:trainingId', () => {
    test('requires authentication', async () => {
      const res = await request(app).put('/api/clubs/1/teams/1/trainings/1');
      expect(res.status).toBe(401);
    });

    test('successfully updates training with sport_id', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                      // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])              // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])    // requireRole
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]);    // UPDATE training
      const res = await authAgent.put('/api/clubs/1/teams/1/trainings/1')
        .set('X-CSRF-Token', csrfToken)
        .send({ title: 'Aktualisiertes Training', date: '2024-08-01', sport_id: 3 });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('aktualisiert');
    });

    test('returns 404 for non-existent training', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                      // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])              // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])    // requireRole
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]);    // UPDATE returns 0
      const res = await authAgent.put('/api/clubs/1/teams/1/trainings/999')
        .set('X-CSRF-Token', csrfToken)
        .send({ title: 'Nicht vorhanden' });
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Training nicht gefunden');
    });
  });

  describe('PUT /api/clubs/:clubId/teams/:teamId/trainings/:trainingId/result', () => {
    test('requires authentication', async () => {
      const res = await request(app).put('/api/clubs/1/teams/1/trainings/1/result');
      expect(res.status).toBe(401);
    });

    test('updates result markdown', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                      // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])              // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])    // requireRole
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]);    // UPDATE result_markdown
      const res = await authAgent.put('/api/clubs/1/teams/1/trainings/1/result')
        .set('X-CSRF-Token', csrfToken)
        .send({ result_markdown: '## Ergebnis\nGut gelaufen.' });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('aktualisiert');
    });

    test('returns 404 for non-existent training', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                      // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])              // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])    // requireRole
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]);    // UPDATE returns 0
      const res = await authAgent.put('/api/clubs/1/teams/1/trainings/999/result')
        .set('X-CSRF-Token', csrfToken)
        .send({ result_markdown: '## Ergebnis' });
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Training nicht gefunden');
    });
  });

  describe('DELETE /api/clubs/:clubId/teams/:teamId/trainings/:trainingId', () => {
    test('requires authentication', async () => {
      const res = await request(app).delete('/api/clubs/1/teams/1/trainings/1');
      expect(res.status).toBe(401);
    });

    test('successfully deletes training', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                      // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])              // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])    // requireRole
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]);    // DELETE training
      const res = await authAgent.delete('/api/clubs/1/teams/1/trainings/1')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelöscht');
    });

    test('returns 404 for non-existent training', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])                      // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])              // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []])    // requireRole
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]);    // DELETE returns 0
      const res = await authAgent.delete('/api/clubs/1/teams/1/trainings/999')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('Training nicht gefunden');
    });
  });
});
