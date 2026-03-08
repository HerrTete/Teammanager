'use strict';

const { mockPool } = require('../../helpers/mockDb');
const gameRepository = require('../../../src/repositories/gameRepository');

describe('Game Repository', () => {
  beforeEach(() => {
    mockPool.execute.mockClear();
  });

  describe('findGamesByTeamId', () => {
    it('returns games for a team ordered by date and kickoff', async () => {
      const games = [{ id: 1, title: 'Match 1', date: '2024-06-01', team_id: 1 }];
      mockPool.execute.mockResolvedValueOnce([games, []]);

      const result = await gameRepository.findGamesByTeamId(1);

      expect(result).toEqual(games);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT g.id, g.title, g.date, g.kickoff_time, g.meeting_time, g.info, g.location_text, g.venue_id, g.opponent, g.team_id, g.created_by, g.created_at FROM games g WHERE g.team_id = ? ORDER BY g.date, g.kickoff_time',
        [1]
      );
    });

    it('returns empty array when no games exist', async () => {
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const result = await gameRepository.findGamesByTeamId(1);

      expect(result).toEqual([]);
    });
  });

  describe('findGameById', () => {
    it('returns a game with venue details', async () => {
      const games = [{ id: 1, title: 'Match 1', venue_name: 'Stadium' }];
      mockPool.execute.mockResolvedValueOnce([games, []]);

      const result = await gameRepository.findGameById(1, 2);

      expect(result).toEqual(games);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT g.*, v.name AS venue_name, v.street AS venue_street, v.house_number AS venue_house_number, v.zip_code AS venue_zip_code, v.city AS venue_city FROM games g LEFT JOIN venues v ON g.venue_id = v.id WHERE g.id = ? AND g.team_id = ?',
        [1, 2]
      );
    });
  });

  describe('createGame', () => {
    it('inserts a game with all fields provided', async () => {
      const insertResult = { insertId: 5, affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([insertResult, []]);
      const data = {
        title: 'Cup Final',
        date: '2024-06-15',
        kickoff_time: '15:00',
        meeting_time: '14:00',
        info: 'Big game',
        location_text: 'Stadium',
        venue_id: 3,
        opponent: 'Rival FC',
        team_id: 1,
        created_by: 10,
      };

      const result = await gameRepository.createGame(data);

      expect(result).toEqual(insertResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT INTO games (title, date, kickoff_time, meeting_time, info, location_text, venue_id, opponent, team_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['Cup Final', '2024-06-15', '15:00', '14:00', 'Big game', 'Stadium', 3, 'Rival FC', 1, 10]
      );
    });

    it('inserts a game with optional fields as null', async () => {
      const insertResult = { insertId: 6, affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([insertResult, []]);
      const data = { title: 'Friendly', team_id: 1, created_by: 10 };

      const result = await gameRepository.createGame(data);

      expect(result).toEqual(insertResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT INTO games (title, date, kickoff_time, meeting_time, info, location_text, venue_id, opponent, team_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        ['Friendly', null, null, null, null, null, null, null, 1, 10]
      );
    });
  });

  describe('updateGame', () => {
    it('updates a game with all fields', async () => {
      const updateResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([updateResult, []]);
      const data = {
        title: 'Updated Match',
        date: '2024-07-01',
        kickoff_time: '18:00',
        meeting_time: '17:00',
        info: 'Updated info',
        location_text: 'New Arena',
        venue_id: 4,
        opponent: 'Other FC',
      };

      const result = await gameRepository.updateGame(1, data, 2);

      expect(result).toEqual(updateResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE games SET title = ?, date = ?, kickoff_time = ?, meeting_time = ?, info = ?, location_text = ?, venue_id = ?, opponent = ? WHERE id = ? AND team_id = ?',
        ['Updated Match', '2024-07-01', '18:00', '17:00', 'Updated info', 'New Arena', 4, 'Other FC', 1, 2]
      );
    });

    it('sets optional fields to null when not provided', async () => {
      const updateResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([updateResult, []]);
      const data = { title: 'Minimal' };

      const result = await gameRepository.updateGame(1, data, 2);

      expect(result).toEqual(updateResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE games SET title = ?, date = ?, kickoff_time = ?, meeting_time = ?, info = ?, location_text = ?, venue_id = ?, opponent = ? WHERE id = ? AND team_id = ?',
        ['Minimal', null, null, null, null, null, null, null, 1, 2]
      );
    });
  });

  describe('deleteGame', () => {
    it('deletes a game and returns the result', async () => {
      const deleteResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([deleteResult, []]);

      const result = await gameRepository.deleteGame(1, 2);

      expect(result).toEqual(deleteResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'DELETE FROM games WHERE id = ? AND team_id = ?',
        [1, 2]
      );
    });
  });

  describe('updateGameResult', () => {
    it('updates game result markdown', async () => {
      const updateResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([updateResult, []]);

      const result = await gameRepository.updateGameResult(1, '# Win 3-0', 2);

      expect(result).toEqual(updateResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE games SET result_markdown = ? WHERE id = ? AND team_id = ?',
        ['# Win 3-0', 1, 2]
      );
    });

    it('sets result_markdown to null when not provided', async () => {
      const updateResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([updateResult, []]);

      const result = await gameRepository.updateGameResult(1, undefined, 2);

      expect(result).toEqual(updateResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE games SET result_markdown = ? WHERE id = ? AND team_id = ?',
        [null, 1, 2]
      );
    });
  });
});
