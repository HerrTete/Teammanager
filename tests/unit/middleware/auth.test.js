'use strict';

const { mockPool } = require('../../helpers/mockDb');
const {
  requireAuth, requireRole, requireClubAccess, ensureCsrfToken, validateCsrf,
} = require('../../../src/middleware/auth');

function createMocks(sessionData = {}, params = {}, headers = {}) {
  return {
    req: { session: sessionData, params, headers },
    res: { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() },
    next: jest.fn(),
  };
}

describe('Auth Middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('requireAuth', () => {
    test('returns 401 when no session userId', () => {
      const { req, res, next } = createMocks({});
      requireAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('calls next() when session has userId', () => {
      const { req, res, next } = createMocks({ userId: 1 });
      requireAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    test('returns 401 when no session', async () => {
      const { req, res, next } = createMocks({});
      await requireRole(['Trainer'])(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('returns 403 when user lacks role', async () => {
      const { req, res, next } = createMocks({ userId: 1 });
      mockPool.execute.mockResolvedValueOnce([[{ role: 'Spieler' }], []]);
      await requireRole(['Trainer'])(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('calls next() when user has role', async () => {
      const { req, res, next } = createMocks({ userId: 1 });
      mockPool.execute.mockResolvedValueOnce([[{ role: 'Trainer' }], []]);
      await requireRole(['Trainer'])(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireClubAccess', () => {
    test('returns 401 when no session', async () => {
      const { req, res, next } = createMocks({}, { clubId: '1' });
      await requireClubAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('returns 403 when not a member', async () => {
      const { req, res, next } = createMocks({ userId: 1 }, { clubId: '1' });
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[], []]);
      await requireClubAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('allows access for PortalAdmin', async () => {
      const { req, res, next } = createMocks({ userId: 1 }, { clubId: '1' });
      mockPool.execute.mockResolvedValueOnce([[{ id: 1 }], []]);
      await requireClubAccess(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('allows access for club member', async () => {
      const { req, res, next } = createMocks({ userId: 1 }, { clubId: '1' });
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []]);
      await requireClubAccess(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('ensureCsrfToken', () => {
    test('creates token when none exists', () => {
      const { req, res, next } = createMocks({});
      ensureCsrfToken(req, res, next);
      expect(req.session.csrfToken).toBeDefined();
      expect(typeof req.session.csrfToken).toBe('string');
      expect(next).toHaveBeenCalled();
    });

    test('preserves existing token', () => {
      const { req, res, next } = createMocks({ csrfToken: 'existing-token' });
      ensureCsrfToken(req, res, next);
      expect(req.session.csrfToken).toBe('existing-token');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('validateCsrf', () => {
    test('returns 403 when token missing', () => {
      const { req, res, next } = createMocks({ csrfToken: 'token123' });
      validateCsrf(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('returns 403 when token mismatch', () => {
      const { req, res, next } = createMocks(
        { csrfToken: 'token123' }, {}, { 'x-csrf-token': 'wrong' }
      );
      validateCsrf(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('calls next() when token matches', () => {
      const { req, res, next } = createMocks(
        { csrfToken: 'token123' }, {}, { 'x-csrf-token': 'token123' }
      );
      validateCsrf(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
