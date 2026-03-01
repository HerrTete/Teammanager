'use strict';

const { mockPool } = require('../../helpers/mockDb');
const request = require('supertest');
const app = require('../../../src/app');
const { getAuthenticatedAgent } = require('../../helpers/testApp');

describe('Message Routes', () => {
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

  describe('GET /api/clubs/:clubId/messages', () => {
    test('requires authentication', async () => {
      const res = await request(app).get('/api/clubs/1/messages');
      expect(res.status).toBe(401);
    });

    test('returns messages for club member', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ id: 1, subject: 'Test', body: 'Hello' }], []]);
      const res = await authAgent.get('/api/clubs/1/messages');
      expect(res.status).toBe(200);
      expect(res.body.messages).toBeDefined();
    });
  });

  describe('POST /api/clubs/:clubId/messages', () => {
    test('validates body is required', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []]);
      const res = await authAgent.post('/api/clubs/1/messages')
        .set('X-CSRF-Token', csrfToken).send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Nachrichtentext');
    });

    test('sends message', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([{ insertId: 1 }, []]) // insert message
        .mockResolvedValueOnce([[], []]); // club members
      const res = await authAgent.post('/api/clubs/1/messages')
        .set('X-CSRF-Token', csrfToken)
        .send({ subject: 'Test', body: 'Nachricht' });
      expect(res.status).toBe(201);
      expect(res.body.messageId).toBeDefined();
    });
  });

  describe('GET /api/clubs/:clubId/messages/:messageId', () => {
    test('returns message thread', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ id: 1, subject: 'Test', body: 'Hello', sender_name: 'user' }], []])
        .mockResolvedValueOnce([[], []]) // replies
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]); // mark read
      const res = await authAgent.get('/api/clubs/1/messages/1');
      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();
      expect(res.body.replies).toBeDefined();
    });
  });

  describe('POST /api/clubs/:clubId/messages/:messageId/reply', () => {
    test('validates body is required', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []]);
      const res = await authAgent.post('/api/clubs/1/messages/1/reply')
        .set('X-CSRF-Token', csrfToken).send({});
      expect(res.status).toBe(400);
    });

    test('posts reply', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ id: 1, target_type: 'club', target_id: 1 }], []])
        .mockResolvedValueOnce([{ insertId: 2 }, []]);
      const res = await authAgent.post('/api/clubs/1/messages/1/reply')
        .set('X-CSRF-Token', csrfToken).send({ body: 'Antwort' });
      expect(res.status).toBe(201);
    });
  });
});
