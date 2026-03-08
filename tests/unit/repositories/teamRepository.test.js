'use strict';

const { mockPool } = require('../../helpers/mockDb');
const teamRepository = require('../../../src/repositories/teamRepository');

describe('Team Repository', () => {
  beforeEach(() => {
    mockPool.execute.mockClear();
  });

  describe('findTeamsBySportId', () => {
    it('returns teams for a sport and club', async () => {
      const teams = [{ id: 1, name: 'Team A', created_at: '2024-01-01' }];
      mockPool.execute.mockResolvedValueOnce([teams, []]);

      const result = await teamRepository.findTeamsBySportId(2, 5);

      expect(result).toEqual(teams);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT t.id, t.name, t.created_at FROM teams t INNER JOIN sports s ON t.sport_id = s.id WHERE t.sport_id = ? AND s.club_id = ? ORDER BY t.name',
        [2, 5]
      );
    });
  });

  describe('findTeamById', () => {
    it('returns a team by id, sport, and club', async () => {
      const teams = [{ id: 1, name: 'Team A', created_at: '2024-01-01' }];
      mockPool.execute.mockResolvedValueOnce([teams, []]);

      const result = await teamRepository.findTeamById(1, 2, 5);

      expect(result).toEqual(teams);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT t.id, t.name, t.created_at FROM teams t INNER JOIN sports s ON t.sport_id = s.id WHERE t.id = ? AND t.sport_id = ? AND s.club_id = ?',
        [1, 2, 5]
      );
    });
  });

  describe('createTeam', () => {
    it('inserts a new team and returns the result', async () => {
      const insertResult = { insertId: 10, affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([insertResult, []]);

      const result = await teamRepository.createTeam(2, 'New Team');

      expect(result).toEqual(insertResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT INTO teams (name, sport_id) VALUES (?, ?)',
        ['New Team', 2]
      );
    });
  });

  describe('updateTeam', () => {
    it('updates a team name and returns the result', async () => {
      const updateResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([updateResult, []]);

      const result = await teamRepository.updateTeam(1, 'Renamed', 2, 5);

      expect(result).toEqual(updateResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE teams t INNER JOIN sports s ON t.sport_id = s.id SET t.name = ? WHERE t.id = ? AND t.sport_id = ? AND s.club_id = ?',
        ['Renamed', 1, 2, 5]
      );
    });
  });

  describe('findTrainers', () => {
    it('returns trainers for a team', async () => {
      const trainers = [{ id: 1, user_id: 10, username: 'coach1' }];
      mockPool.execute.mockResolvedValueOnce([trainers, []]);

      const result = await teamRepository.findTrainers(1);

      expect(result).toEqual(trainers);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT tt.id, tt.user_id, u.username FROM team_trainers tt INNER JOIN users u ON tt.user_id = u.id WHERE tt.team_id = ?',
        [1]
      );
    });
  });

  describe('addTrainer', () => {
    it('inserts a trainer for a team', async () => {
      const insertResult = { insertId: 5, affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([insertResult, []]);

      const result = await teamRepository.addTrainer(1, 10);

      expect(result).toEqual(insertResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT INTO team_trainers (team_id, user_id) VALUES (?, ?)',
        [1, 10]
      );
    });
  });

  describe('findTrainerRole', () => {
    it('returns trainer role rows for a user and team', async () => {
      const rows = [{ id: 3 }];
      mockPool.execute.mockResolvedValueOnce([rows, []]);

      const result = await teamRepository.findTrainerRole(10, 1);

      expect(result).toEqual(rows);
      expect(mockPool.execute).toHaveBeenCalledWith(
        "SELECT id FROM user_roles WHERE user_id = ? AND role = 'Trainer' AND team_id = ?",
        [10, 1]
      );
    });
  });

  describe('insertTrainerRole', () => {
    it('inserts a trainer role and returns the result', async () => {
      const insertResult = { insertId: 7, affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([insertResult, []]);

      const result = await teamRepository.insertTrainerRole(10, 5, 2, 1);

      expect(result).toEqual(insertResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        "INSERT INTO user_roles (user_id, role, club_id, sport_id, team_id) VALUES (?, 'Trainer', ?, ?, ?)",
        [10, 5, 2, 1]
      );
    });
  });

  describe('removeTrainer', () => {
    it('deletes a trainer from a team', async () => {
      const deleteResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([deleteResult, []]);

      const result = await teamRepository.removeTrainer(1, 10);

      expect(result).toEqual(deleteResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'DELETE FROM team_trainers WHERE team_id = ? AND user_id = ?',
        [1, 10]
      );
    });
  });

  describe('findPlayers', () => {
    it('returns players for a team', async () => {
      const players = [{ id: 1, user_id: 20, jersey_number: 7, username: 'player1' }];
      mockPool.execute.mockResolvedValueOnce([players, []]);

      const result = await teamRepository.findPlayers(1);

      expect(result).toEqual(players);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT p.id, p.user_id, p.jersey_number, u.username FROM players p INNER JOIN users u ON p.user_id = u.id WHERE p.team_id = ?',
        [1]
      );
    });
  });

  describe('addPlayer', () => {
    it('inserts a player into a team', async () => {
      const insertResult = { insertId: 15, affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([insertResult, []]);

      const result = await teamRepository.addPlayer(1, 20, 7);

      expect(result).toEqual(insertResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT INTO players (user_id, team_id, jersey_number) VALUES (?, ?, ?)',
        [20, 1, 7]
      );
    });
  });

  describe('removePlayer', () => {
    it('deletes a player from a team', async () => {
      const deleteResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([deleteResult, []]);

      const result = await teamRepository.removePlayer(15, 1);

      expect(result).toEqual(deleteResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'DELETE FROM players WHERE id = ? AND team_id = ?',
        [15, 1]
      );
    });
  });

  describe('findSportByIdAndClub', () => {
    it('returns sport rows matching id and club', async () => {
      const rows = [{ id: 2 }];
      mockPool.execute.mockResolvedValueOnce([rows, []]);

      const result = await teamRepository.findSportByIdAndClub(2, 5);

      expect(result).toEqual(rows);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT id FROM sports WHERE id = ? AND club_id = ?',
        [2, 5]
      );
    });
  });
});
