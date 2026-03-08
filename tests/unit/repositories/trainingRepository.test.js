'use strict';

const { mockPool } = require('../../helpers/mockDb');
const trainingRepository = require('../../../src/repositories/trainingRepository');

describe('Training Repository', () => {
  beforeEach(() => {
    mockPool.execute.mockClear();
  });

  describe('findTrainingsByTeamId', () => {
    it('returns trainings for a team ordered by date and time', async () => {
      const trainings = [{ id: 1, title: 'Session 1', date: '2024-06-01', team_id: 1 }];
      mockPool.execute.mockResolvedValueOnce([trainings, []]);

      const result = await trainingRepository.findTrainingsByTeamId(1);

      expect(result).toEqual(trainings);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT t.id, t.title, t.date, t.time, t.location_text, t.venue_id, t.sport_id, t.team_id, t.created_by, t.created_at FROM trainings t WHERE t.team_id = ? ORDER BY t.date, t.time',
        [1]
      );
    });

    it('returns empty array when no trainings exist', async () => {
      mockPool.execute.mockResolvedValueOnce([[], []]);

      const result = await trainingRepository.findTrainingsByTeamId(1);

      expect(result).toEqual([]);
    });
  });

  describe('findTrainingById', () => {
    it('returns a training with venue details', async () => {
      const trainings = [{ id: 1, title: 'Session 1', venue_name: 'Field' }];
      mockPool.execute.mockResolvedValueOnce([trainings, []]);

      const result = await trainingRepository.findTrainingById(1, 2);

      expect(result).toEqual(trainings);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT t.*, v.name AS venue_name, v.street AS venue_street, v.house_number AS venue_house_number, v.zip_code AS venue_zip_code, v.city AS venue_city FROM trainings t LEFT JOIN venues v ON t.venue_id = v.id WHERE t.id = ? AND t.team_id = ?',
        [1, 2]
      );
    });
  });

  describe('createTraining', () => {
    it('inserts a training with all fields', async () => {
      const insertResult = { insertId: 5, affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([insertResult, []]);
      const data = {
        title: 'Morning Run',
        date: '2024-06-10',
        time: '08:00',
        location_text: 'Park',
        venue_id: 3,
        sport_id: 2,
        team_id: 1,
        created_by: 10,
      };

      const result = await trainingRepository.createTraining(data);

      expect(result).toEqual(insertResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT INTO trainings (title, date, time, location_text, venue_id, sport_id, team_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['Morning Run', '2024-06-10', '08:00', 'Park', 3, 2, 1, 10]
      );
    });

    it('inserts a training with optional fields as null', async () => {
      const insertResult = { insertId: 6, affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([insertResult, []]);
      const data = { title: 'Quick Session', team_id: 1, created_by: 10 };

      const result = await trainingRepository.createTraining(data);

      expect(result).toEqual(insertResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT INTO trainings (title, date, time, location_text, venue_id, sport_id, team_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['Quick Session', null, null, null, null, null, 1, 10]
      );
    });
  });

  describe('updateTraining', () => {
    it('updates a training with all fields', async () => {
      const updateResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([updateResult, []]);
      const data = {
        title: 'Updated Session',
        date: '2024-07-01',
        time: '10:00',
        location_text: 'Gym',
        venue_id: 4,
        sport_id: 3,
      };

      const result = await trainingRepository.updateTraining(1, data, 2);

      expect(result).toEqual(updateResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE trainings SET title = ?, date = ?, time = ?, location_text = ?, venue_id = ?, sport_id = ? WHERE id = ? AND team_id = ?',
        ['Updated Session', '2024-07-01', '10:00', 'Gym', 4, 3, 1, 2]
      );
    });

    it('sets optional fields to null when not provided', async () => {
      const updateResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([updateResult, []]);
      const data = { title: 'Minimal' };

      const result = await trainingRepository.updateTraining(1, data, 2);

      expect(result).toEqual(updateResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE trainings SET title = ?, date = ?, time = ?, location_text = ?, venue_id = ?, sport_id = ? WHERE id = ? AND team_id = ?',
        ['Minimal', null, null, null, null, null, 1, 2]
      );
    });
  });

  describe('deleteTraining', () => {
    it('deletes a training and returns the result', async () => {
      const deleteResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([deleteResult, []]);

      const result = await trainingRepository.deleteTraining(1, 2);

      expect(result).toEqual(deleteResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'DELETE FROM trainings WHERE id = ? AND team_id = ?',
        [1, 2]
      );
    });
  });

  describe('updateTrainingResult', () => {
    it('updates training result markdown', async () => {
      const updateResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([updateResult, []]);

      const result = await trainingRepository.updateTrainingResult(1, '# Great session', 2);

      expect(result).toEqual(updateResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE trainings SET result_markdown = ? WHERE id = ? AND team_id = ?',
        ['# Great session', 1, 2]
      );
    });

    it('sets result_markdown to null when not provided', async () => {
      const updateResult = { affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([updateResult, []]);

      const result = await trainingRepository.updateTrainingResult(1, undefined, 2);

      expect(result).toEqual(updateResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'UPDATE trainings SET result_markdown = ? WHERE id = ? AND team_id = ?',
        [null, 1, 2]
      );
    });
  });

  describe('addTrainingTeam', () => {
    it('inserts a training-team association', async () => {
      const insertResult = { insertId: 1, affectedRows: 1 };
      mockPool.execute.mockResolvedValueOnce([insertResult, []]);

      const result = await trainingRepository.addTrainingTeam(5, 3);

      expect(result).toEqual(insertResult);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'INSERT INTO training_teams (training_id, team_id) VALUES (?, ?)',
        [5, 3]
      );
    });
  });

  describe('findTrainingTeams', () => {
    it('returns teams associated with a training', async () => {
      const teams = [{ team_id: 3, team_name: 'Team C' }];
      mockPool.execute.mockResolvedValueOnce([teams, []]);

      const result = await trainingRepository.findTrainingTeams(5);

      expect(result).toEqual(teams);
      expect(mockPool.execute).toHaveBeenCalledWith(
        'SELECT tt.team_id, t.name AS team_name FROM training_teams tt INNER JOIN teams t ON tt.team_id = t.id WHERE tt.training_id = ?',
        [5]
      );
    });
  });
});
