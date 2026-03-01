'use strict';

const { mockPool } = require('../../helpers/mockDb');
const request = require('supertest');
const app = require('../../../src/app');
const { getAuthenticatedAgent } = require('../../helpers/testApp');

describe('Attendance Routes', () => {
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

  describe('GET /api/clubs/:clubId/events/:eventType/:eventId/attendance', () => {
    test('requires authentication', async () => {
      const res = await request(app).get('/api/clubs/1/events/game/1/attendance');
      expect(res.status).toBe(401);
    });

    test('validates eventType', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []]);
      const res = await authAgent.get('/api/clubs/1/events/invalid/1/attendance');
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Eventtyp');
    });

    test('returns attendance list', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ id: 1 }], []])   // verifyEventBelongsToClub
        .mockResolvedValueOnce([[{ id: 1, user_id: 1, status: 'accepted', username: 'user1' }], []]); // SELECT attendance
      const res = await authAgent.get('/api/clubs/1/events/game/1/attendance');
      expect(res.status).toBe(200);
      expect(res.body.attendance).toBeDefined();
    });
  });

  describe('POST /api/clubs/:clubId/events/:eventType/:eventId/attendance', () => {
    test('validates status (accept/decline)', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []]);
      const res = await authAgent.post('/api/clubs/1/events/game/1/attendance')
        .set('X-CSRF-Token', csrfToken).send({ status: 'invalid' });
      expect(res.status).toBe(400);
    });

    test('accepts RSVP', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ id: 1 }], []])   // verifyEventBelongsToClub
        .mockResolvedValueOnce([[], []])            // no existing attendance
        .mockResolvedValueOnce([{ insertId: 1 }, []]); // insert
      const res = await authAgent.post('/api/clubs/1/events/game/1/attendance')
        .set('X-CSRF-Token', csrfToken).send({ status: 'accepted' });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gespeichert');
    });
  });
});
