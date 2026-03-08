'use strict';

const { mockPool } = require('../../helpers/mockDb');
const clubRepository = require('../../../src/repositories/clubRepository');

describe('Club Repository', () => {
  beforeEach(() => {
    mockPool.execute.mockClear();
  });

  describe('findAllClubs', () => {
    it('returns all clubs ordered by name', async () => {
      const clubs = [{ id: 1, name: 'FC Test', created_at: '2024-01-01' }];
      mockPool.execute.mockResolvedValueOnce([clubs, []]);

      const result = await clubRepository.findAllClubs();

      expect(result).toEqual(clubs);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT id, name, created_at FROM clubs ORDER BY name'
      );
    });

    it('returns empty array when no clubs exist', async () => {
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const result = await clubRepository.findAllClubs();

      expect(result).toEqual([]);
    });
  });

  describe('findClubsByUserId', () => {
    it('returns clubs for a given user', async () => {
      const clubs = [{ id: 2, name: 'Club A', created_at: '2024-01-01' }];
      mockPool.execute.mockResolvedValueOnce([clubs, []]);

      const result = await clubRepository.findClubsByUserId(42);

      expect(result).toEqual(clubs);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT c.id, c.name, c.created_at FROM clubs c INNER JOIN club_members cm ON c.id = cm.club_id WHERE cm.user_id = ? ORDER BY c.name',
        [42]
      );
    });
  });

  describe('findClubById', () => {
    it('returns a club by id', async () => {
      const clubs = [{ id: 5, name: 'Club Five', created_at: '2024-01-01' }];
      mockPool.execute.mockResolvedValueOnce([clubs, []]);

      const result = await clubRepository.findClubById(5);

      expect(result).toEqual(clubs);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT id, name, created_at FROM clubs WHERE id = ?',
        [5]
      );
    });

    it('returns empty array when club not found', async () => {
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const result = await clubRepository.findClubById(999);

      expect(result).toEqual([]);
    });
  });

  describe('createClub', () => {
    it('inserts a new club and returns the result', async () => {
      const insertResult = { insertId: 10, affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([insertResult, []]);

      const result = await clubRepository.createClub('New Club');

      expect(result).toEqual(insertResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT INTO clubs (name) VALUES (?)',
        ['New Club']
      );
    });
  });

  describe('updateClub', () => {
    it('updates a club name and returns the result', async () => {
      const updateResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([updateResult, []]);

      const result = await clubRepository.updateClub(3, 'Renamed Club');

      expect(result).toEqual(updateResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE clubs SET name = ? WHERE id = ?',
        ['Renamed Club', 3]
      );
    });
  });

  describe('updateClubLogo', () => {
    it('updates club logo and mime type', async () => {
      const updateResult = { affectedRows: 1 };
      const logoBuffer = Buffer.from('logo-data');
      mockPool.execute.mockResolvedValueOnce([updateResult, []]);

      const result = await clubRepository.updateClubLogo(3, logoBuffer, 'image/png');

      expect(result).toEqual(updateResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE clubs SET logo = ?, logo_mime = ? WHERE id = ?',
        [logoBuffer, 'image/png', 3]
      );
    });
  });

  describe('findClubLogo', () => {
    it('returns logo data for a club', async () => {
      const rows = [{ logo: Buffer.from('logo'), logo_mime: 'image/png' }];
      mockPool.execute.mockResolvedValueOnce([rows, []]);

      const result = await clubRepository.findClubLogo(3);

      expect(result).toEqual(rows);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT logo, logo_mime FROM clubs WHERE id = ?',
        [3]
      );
    });
  });
});
