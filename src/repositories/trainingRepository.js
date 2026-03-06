'use strict';

const { pool } = require('../db');

async function findTrainingsByTeamId(teamId) {
  const [rows] = await pool.execute(
    'SELECT t.id, t.title, t.date, t.time, t.location_text, t.venue_id, t.sport_id, t.team_id, t.created_by, t.created_at FROM trainings t WHERE t.team_id = ? ORDER BY t.date, t.time',
    [teamId]
  );
  return rows;
}

async function findTrainingById(trainingId, teamId) {
  const [rows] = await pool.execute(
    'SELECT t.*, v.name AS venue_name, v.street AS venue_street, v.house_number AS venue_house_number, v.zip_code AS venue_zip_code, v.city AS venue_city FROM trainings t LEFT JOIN venues v ON t.venue_id = v.id WHERE t.id = ? AND t.team_id = ?',
    [trainingId, teamId]
  );
  return rows;
}

async function createTraining(data) {
  const { title, date, time, location_text, venue_id, sport_id, team_id, created_by } = data;
  const [result] = await pool.execute(
    'INSERT INTO trainings (title, date, time, location_text, venue_id, sport_id, team_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [title, date || null, time || null, location_text || null, venue_id || null, sport_id || null, team_id, created_by]
  );
  return result;
}

async function updateTraining(trainingId, data, teamId) {
  const { title, date, time, location_text, venue_id, sport_id } = data;
  const [result] = await pool.execute(
    'UPDATE trainings SET title = ?, date = ?, time = ?, location_text = ?, venue_id = ?, sport_id = ? WHERE id = ? AND team_id = ?',
    [title, date || null, time || null, location_text || null, venue_id || null, sport_id || null, trainingId, teamId]
  );
  return result;
}

async function deleteTraining(trainingId, teamId) {
  const [result] = await pool.execute('DELETE FROM trainings WHERE id = ? AND team_id = ?', [trainingId, teamId]);
  return result;
}

async function updateTrainingResult(trainingId, resultMarkdown, teamId) {
  const [result] = await pool.execute(
    'UPDATE trainings SET result_markdown = ? WHERE id = ? AND team_id = ?',
    [resultMarkdown || null, trainingId, teamId]
  );
  return result;
}

async function addTrainingTeam(trainingId, teamId) {
  const [result] = await pool.execute(
    'INSERT INTO training_teams (training_id, team_id) VALUES (?, ?)',
    [trainingId, teamId]
  );
  return result;
}

async function findTrainingTeams(trainingId) {
  const [rows] = await pool.execute(
    'SELECT tt.team_id, t.name AS team_name FROM training_teams tt INNER JOIN teams t ON tt.team_id = t.id WHERE tt.training_id = ?',
    [trainingId]
  );
  return rows;
}

module.exports = {
  findTrainingsByTeamId,
  findTrainingById,
  createTraining,
  updateTraining,
  deleteTraining,
  updateTrainingResult,
  addTrainingTeam,
  findTrainingTeams,
};
