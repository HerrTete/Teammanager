'use strict';

const { mockPool } = require('../../helpers/mockDb');

jest.mock('../../../src/services/pdf', () => ({
  generateSchedulePDF: jest.fn().mockResolvedValue(Buffer.from('pdf-data')),
  generateAttendanceListPDF: jest.fn().mockResolvedValue(Buffer.from('pdf-data')),
}));

const request = require('supertest');
const app = require('../../../src/app');
const { getAuthenticatedAgent } = require('../../helpers/testApp');

describe('Export Routes', () => {
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

  describe('GET /api/clubs/:clubId/teams/:teamId/schedule/ical', () => {
    test('requires authentication', async () => {
      const res = await request(app).get('/api/clubs/1/teams/1/schedule/ical');
      expect(res.status).toBe(401);
    });

    test('returns iCal data', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[], []]) // games
        .mockResolvedValueOnce([[], []]); // trainings
      const res = await authAgent.get('/api/clubs/1/teams/1/schedule/ical');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/calendar');
    });
  });

  describe('GET /api/clubs/:clubId/teams/:teamId/schedule/pdf', () => {
    test('returns PDF', async () => {
      const { generateSchedulePDF } = require('../../../src/services/pdf');
      generateSchedulePDF.mockResolvedValue(Buffer.from('pdf-data'));
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[], []]) // games
        .mockResolvedValueOnce([[{ logo: null }], []]); // club
      const res = await authAgent.get('/api/clubs/1/teams/1/schedule/pdf');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });
  });

  describe('GET /api/clubs/:clubId/events/:eventType/:eventId/attendance/pdf', () => {
    test('returns attendance PDF', async () => {
      const { generateAttendanceListPDF } = require('../../../src/services/pdf');
      generateAttendanceListPDF.mockResolvedValue(Buffer.from('pdf-data'));
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ id: 1, title: 'Game', date: '2024-01-01' }], []])
        .mockResolvedValueOnce([[], []]) // attendance
        .mockResolvedValueOnce([[{ logo: null }], []]); // club
      const res = await authAgent.get('/api/clubs/1/events/game/1/attendance/pdf');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });
  });
});
