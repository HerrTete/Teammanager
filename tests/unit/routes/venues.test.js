'use strict';

const { mockPool } = require('../../helpers/mockDb');
const request = require('supertest');
const app = require('../../../src/app');
const { getAuthenticatedAgent } = require('../../helpers/testApp');

describe('Venue Routes', () => {
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

  describe('GET /api/clubs/:clubId/venues', () => {
    test('requires authentication', async () => {
      const res = await request(app).get('/api/clubs/1/venues');
      expect(res.status).toBe(401);
    });

    test('returns venues for club member', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ id: 1, name: 'Stadion', street: 'Str.', house_number: '1', zip_code: '12345', city: 'Berlin' }], []]);
      const res = await authAgent.get('/api/clubs/1/venues');
      expect(res.status).toBe(200);
      expect(res.body.venues).toBeDefined();
    });

    test('returns all venue fields including address and link fields', async () => {
      const venueData = {
        id: 1,
        name: 'Stadion',
        zip_code: '12345',
        street: 'Hauptstraße',
        house_number: '42',
        city: 'Berlin',
        link: 'https://example.com/stadion',
        google_maps_link: 'https://maps.google.com/?q=Stadion',
        created_at: '2024-01-01T00:00:00.000Z',
      };
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[venueData], []]);
      const res = await authAgent.get('/api/clubs/1/venues');
      expect(res.status).toBe(200);
      const venue = res.body.venues[0];
      expect(venue.zip_code).toBe('12345');
      expect(venue.street).toBe('Hauptstraße');
      expect(venue.house_number).toBe('42');
      expect(venue.city).toBe('Berlin');
      expect(venue.link).toBe('https://example.com/stadion');
      expect(venue.google_maps_link).toBe('https://maps.google.com/?q=Stadion');
    });
  });

  describe('POST /api/clubs/:clubId/venues', () => {
    test('validates required name field', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []]);
      const res = await authAgent.post('/api/clubs/1/venues')
        .set('X-CSRF-Token', csrfToken).send({});
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('erforderlich');
    });

    test('creates venue with valid data', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])
        .mockResolvedValueOnce([{ insertId: 1 }, []]);
      const res = await authAgent.post('/api/clubs/1/venues')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Stadion', street: 'Str.', house_number: '1', zip_code: '12345', city: 'Berlin' });
      expect(res.status).toBe(201);
      expect(res.body.venueId).toBe(1);
    });

    test('trainer cannot create venues', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []]);
      const res = await authAgent.post('/api/clubs/1/venues')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Stadion', street: 'Str.', house_number: '1', zip_code: '12345', city: 'Berlin' });
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/clubs/:clubId/venues/:venueId', () => {
    test('validates name is required', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []]);
      const res = await authAgent.put('/api/clubs/1/venues/1')
        .set('X-CSRF-Token', csrfToken).send({ name: '' });
      expect(res.status).toBe(400);
    });

    test('trainer cannot update venues', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'Trainer' }], []]);
      const res = await authAgent.put('/api/clubs/1/venues/1')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Updated Stadion' });
      expect(res.status).toBe(403);
    });

    test('successfully updates venue with structured address fields', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      const res = await authAgent.put('/api/clubs/1/venues/1')
        .set('X-CSRF-Token', csrfToken)
        .send({
          name: 'Updated Stadion',
          zip_code: '54321',
          street: 'Neue Straße',
          house_number: '10',
          city: 'München',
          link: 'https://example.com/updated',
          google_maps_link: 'https://maps.google.com/?q=Updated',
        });
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('aktualisiert');
    });

    test('returns 404 when venue not found', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]);
      const res = await authAgent.put('/api/clubs/1/venues/999')
        .set('X-CSRF-Token', csrfToken)
        .send({ name: 'Nonexistent Venue' });
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('nicht gefunden');
    });
  });

  describe('DELETE /api/clubs/:clubId/venues/:venueId', () => {
    test('requires authentication', async () => {
      const res = await request(app).delete('/api/clubs/1/venues/1');
      expect(res.status).toBe(401);
    });

    test('successfully deletes venue', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])
        .mockResolvedValueOnce([{ affectedRows: 1 }, []]);
      const res = await authAgent.delete('/api/clubs/1/venues/1')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelöscht');
    });

    test('returns 404 when venue not found', async () => {
      mockPool.execute
        .mockResolvedValueOnce([[], []])
        .mockResolvedValueOnce([[{ id: 1 }], []])
        .mockResolvedValueOnce([[{ role: 'VereinsAdmin' }], []])
        .mockResolvedValueOnce([{ affectedRows: 0 }, []]);
      const res = await authAgent.delete('/api/clubs/1/venues/999')
        .set('X-CSRF-Token', csrfToken);
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('nicht gefunden');
    });
  });
});
