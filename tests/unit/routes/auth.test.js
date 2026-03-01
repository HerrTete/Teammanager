'use strict';

const { mockPool } = require('../../helpers/mockDb');
const request = require('supertest');
const app = require('../../../src/app');

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.execute.mockResolvedValue([[], []]);
    mockPool.getConnection.mockResolvedValue({
      execute: jest.fn().mockResolvedValue([[], []]),
      release: jest.fn(),
    });
  });

  describe('GET /api/auth/captcha', () => {
    test('returns question and csrfToken', async () => {
      const res = await request(app).get('/api/auth/captcha');
      expect(res.status).toBe(200);
      expect(res.body.question).toBeDefined();
      expect(res.body.csrfToken).toBeDefined();
    });
  });

  describe('GET /api/auth/csrf-token', () => {
    test('returns csrfToken', async () => {
      const res = await request(app).get('/api/auth/csrf-token');
      expect(res.status).toBe(200);
      expect(typeof res.body.csrfToken).toBe('string');
    });
  });

  describe('POST /api/auth/register', () => {
    async function getAgentWithCaptcha() {
      const agent = request.agent(app);
      const captchaRes = await agent.get('/api/auth/captcha');
      const csrfToken = captchaRes.body.csrfToken;
      const m = captchaRes.body.question.match(/(\d+) \+ (\d+)/);
      const captcha = parseInt(m[1]) + parseInt(m[2]);
      return { agent, csrfToken, captcha };
    }

    test('validates required fields', async () => {
      const { agent, csrfToken } = await getAgentWithCaptcha();
      const res = await agent.post('/api/auth/register')
        .set('X-CSRF-Token', csrfToken).send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('erforderlich');
    });

    test('validates username length', async () => {
      const { agent, csrfToken, captcha } = await getAgentWithCaptcha();
      const res = await agent.post('/api/auth/register')
        .set('X-CSRF-Token', csrfToken)
        .send({ username: 'ab', email: 'a@b.com', password: 'Test1234!', captcha });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('3');
    });

    test('validates email format', async () => {
      const { agent, csrfToken, captcha } = await getAgentWithCaptcha();
      const res = await agent.post('/api/auth/register')
        .set('X-CSRF-Token', csrfToken)
        .send({ username: 'testuser', email: 'bad', password: 'Test1234!', captcha });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('E-Mail');
    });

    test('validates password minimum length', async () => {
      const { agent, csrfToken, captcha } = await getAgentWithCaptcha();
      const res = await agent.post('/api/auth/register')
        .set('X-CSRF-Token', csrfToken)
        .send({ username: 'testuser', email: 'a@b.com', password: 'Sh1!', captcha });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('8 Zeichen');
    });

    test('validates password strength', async () => {
      const { agent, csrfToken, captcha } = await getAgentWithCaptcha();
      const res = await agent.post('/api/auth/register')
        .set('X-CSRF-Token', csrfToken)
        .send({ username: 'testuser', email: 'a@b.com', password: 'noupperno1!', captcha });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Großbuchstaben');
    });
  });

  describe('POST /api/auth/verify-email', () => {
    test('returns error without pending registration', async () => {
      const agent = request.agent(app);
      const csrfRes = await agent.get('/api/auth/csrf-token');
      const res = await agent.post('/api/auth/verify-email')
        .set('X-CSRF-Token', csrfRes.body.csrfToken)
        .send({ code: '123456' });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('ausstehende Registrierung');
    });
  });

  describe('POST /api/auth/login', () => {
    test('validates required fields', async () => {
      const agent = request.agent(app);
      const csrfRes = await agent.get('/api/auth/csrf-token');
      const res = await agent.post('/api/auth/login')
        .set('X-CSRF-Token', csrfRes.body.csrfToken).send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('erforderlich');
    });
  });

  describe('GET /api/auth/status', () => {
    test('returns loggedIn false when not logged in', async () => {
      const res = await request(app).get('/api/auth/status');
      expect(res.status).toBe(200);
      expect(res.body.loggedIn).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('requires CSRF token', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(403);
    });
  });
});
