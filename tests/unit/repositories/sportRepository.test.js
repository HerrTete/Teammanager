'use strict';

const { mockPool } = require('../../helpers/mockDb');
const sportRepository = require('../../../src/repositories/sportRepository');

describe('Sport Repository', () => {
  beforeEach(() => {
    mockPool.execute.mockClear();
  });

  describe('findSportsByClubId', () => {
    it('returns sports for a club ordered by name', async () => {
      const sports = [{ id: 1, name: 'Football', created_at: '2024-01-01' }];
      mockPool.execute.mockResolvedValueOnce([sports, []]);

      const result = await sportRepository.findSportsByClubId(5);

      expect(result).toEqual(sports);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT id, name, created_at FROM sports WHERE club_id = ? ORDER BY name',
        [5]
      );
    });

    it('returns empty array when no sports exist', async () => {
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const result = await sportRepository.findSportsByClubId(5);

      expect(result).toEqual([]);
    });
  });

  describe('findSportById', () => {
    it('returns a sport by id', async () => {
      const sports = [{ id: 1, name: 'Football', club_id: 5, created_at: '2024-01-01' }];
      mockPool.execute.mockResolvedValueOnce([sports, []]);

      const result = await sportRepository.findSportById(1);

      expect(result).toEqual(sports);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT id, name, club_id, created_at FROM sports WHERE id = ?',
        [1]
      );
    });
  });

  describe('createSport', () => {
    it('inserts a new sport and returns the result', async () => {
      const insertResult = { insertId: 3, affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([insertResult, []]);

      const result = await sportRepository.createSport(5, 'Basketball');

      expect(result).toEqual(insertResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT INTO sports (name, club_id) VALUES (?, ?)',
        ['Basketball', 5]
      );
    });
  });

  describe('updateSport', () => {
    it('updates a sport name and returns the result', async () => {
      const updateResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([updateResult, []]);

      const result = await sportRepository.updateSport(1, 'Tennis', 5);

      expect(result).toEqual(updateResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE sports SET name = ? WHERE id = ? AND club_id = ?',
        ['Tennis', 1, 5]
      );
    });
  });

  describe('deleteSport', () => {
    it('deletes a sport and returns the result', async () => {
      const deleteResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([deleteResult, []]);

      const result = await sportRepository.deleteSport(1, 5);

      expect(result).toEqual(deleteResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'DELETE FROM sports WHERE id = ? AND club_id = ?',
        [1, 5]
      );
    });
  });
});
