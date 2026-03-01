'use strict';

const { mockPool } = require('../../helpers/mockDb');

jest.mock('../../../src/services/email', () => ({
  sendInvitation: jest.fn().mockResolvedValue({ messageId: 'test' }),
  getMailTransporter: jest.fn().mockResolvedValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test' }),
  }),
  sendNotificationEmail: jest.fn().mockResolvedValue({ messageId: 'test' }),
  sendAttendanceReminder: jest.fn().mockResolvedValue({ messageId: 'test' }),
  sendEscalation: jest.fn().mockResolvedValue({ messageId: 'test' }),
}));

const request = require('supertest');
const app = require('../../../src/app');
const { getAuthenticatedAgent } = require('../../helpers/testApp');

describe('Invitation Routes', () => {
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

  describe('POST /api/clubs/:clubId/invitations', () => {
    test('requires authentication', async () => {
      const res = await request(app).post('/api/clubs/1/invitations');
      expect(res.status).toBe(401);
    });

    test('creates invitation with valid data', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])
        .mockResolvedValueOnce([{ insertId: 1 }, []]) // insert invitation
        .mockResolvedValueOnce([[{ name: 'FC Test' }], []]); // club name
      const res = await authAgent.post('/api/clubs/1/invitations')
        .set('X-CSRF-Token', csrfToken)
        .send({ email: 'new@example.com', role: 'Vereinsmitglied' });
      expect(res.status).toBe(201);
      expect(res.body.code).toBeDefined();
    });
  });

  describe('GET /api/invitations/code/:code', () => {
    test('returns invitation by code', async () => {
      mockPool.execute.mockResolvedValueOnce([
        [{ id: 1, email: 'a@b.com', role: 'Spieler', club_name: 'FC Test', accepted: false }], [],
      ]);
      const res = await request(app).get('/api/invitations/code/test-code');
      expect(res.status).toBe(200);
      expect(res.body.invitation).toBeDefined();
    });

    test('returns 404 for invalid code', async () => {
      mockPool.execute.mockResolvedValueOnce([[], []]);
      const res = await request(app).get('/api/invitations/code/invalid');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/invitations/code/:code/accept', () => {
    test('requires authentication', async () => {
      const res = await request(app).post('/api/invitations/code/test/accept');
      expect(res.status).toBe(401);
    });

    test('accepts invitation', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[{ id: 1, code: 'c', role: 'Spieler', club_id: 1, accepted: false }], []])
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]) // mark accepted
        .mockResolvedValueOnce([[], []]) // no existing member
        .mockResolvedValueOnce([{ insertId: 1 }, []]) // insert member
        .mockResolvedValueOnce([{ insertId: 1 }, []]); // insert role
      const res = await authAgent.post('/api/invitations/code/test-code/accept')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('angenommen');
    });
  });
});
