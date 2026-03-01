'use strict';

const { mockPool } = require('../../helpers/mockDb');
const request = require('supertest');
const app = require('../../../src/app');
const { getAuthenticatedAgent } = require('../../helpers/testApp');

describe('Photo Routes', () => {
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

  describe('POST /api/clubs/:clubId/events/:eventType/:eventId/photos', () => {
    test('requires authentication', async () => {
      const res = await request(app).post('/api/clubs/1/events/game/1/photos');
      expect(res.status).toBe(401);
    });

    test('uploads photo', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ id: 1 }], []])   // verifyEventBelongsToClub
        .mockResolvedValueOnce([{ insertId: 1 }, []]); // INSERT
      const res = await authAgent.post('/api/clubs/1/events/game/1/photos')
        .set('X-CSRF-Token', csrfToken)
        .attach('photo', Buffer.from('fake-image-data'), 'test.jpg');
      expect(res.status).toBe(201);
      expect(res.body.photoId).toBeDefined();
    });
  });

  describe('GET /api/clubs/:clubId/events/:eventType/:eventId/photos', () => {
    test('returns photo list', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])           // requireClubAccess: PortalAdmin
        .mockResolvedValueOnce([[{ id: 1 }], []])   // requireClubAccess: club_members
        .mockResolvedValueOnce([[{ id: 1 }], []])   // verifyEventBelongsToClub
        .mockResolvedValueOnce([[{ id: 1, filename: 'test.jpg', mime_type: 'image/jpeg' }], []]); // SELECT
      const res = await authAgent.get('/api/clubs/1/events/game/1/photos');
      expect(res.status).toBe(200);
      expect(res.body.photos).toBeDefined();
    });
  });

  describe('GET /api/photos/:photoId', () => {
    test('requires authentication', async () => {
      const res = await request(app).get('/api/photos/1');
      expect(res.status).toBe(401);
    });

    test('returns 404 for disabled direct access', async () => {
      const res = await authAgent.get('/api/photos/1');
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/photos/:photoId', () => {
    test('requires authentication', async () => {
      const res = await request(app).delete('/api/photos/1');
      expect(res.status).toBe(401);
    });
  });
});
