'use strict';

const { pool } = require('../db');

async function findGamesByTeamId(teamId) {
  const [rows] = await pool.execute(
    'SELECT g.id, g.title, g.date, g.kickoff_time, g.meeting_time, g.info, g.location_text, g.venue_id, g.opponent, g.team_id, g.created_by, g.created_at FROM games g WHERE g.team_id = ? ORDER BY g.date, g.kickoff_time',
    [teamId]
  );
  return rows;
}

async function findGameById(gameId, teamId) {
  const [rows] = await pool.execute(
    'SELECT g.*, v.name AS venue_name, v.street AS venue_street, v.house_number AS venue_house_number, v.zip_code AS venue_zip_code, v.city AS venue_city FROM games g LEFT JOIN venues v ON g.venue_id = v.id WHERE g.id = ? AND g.team_id = ?',
    [gameId, teamId]
  );
  return rows;
}

async function createGame(data) {
  const { title, date, kickoff_time, meeting_time, info, location_text, venue_id, opponent, team_id, created_by } = data;
  const [result] = await pool.execute(
    'INSERT INTO games (title, date, kickoff_time, meeting_time, info, location_text, venue_id, opponent, team_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [title, date || null, kickoff_time || null, meeting_time || null, info || null, location_text || null, venue_id || null, opponent || null, team_id, created_by]
  );
  return result;
}

async function updateGame(gameId, data, teamId) {
  const { title, date, kickoff_time, meeting_time, info, location_text, venue_id, opponent } = data;
  const [result] = await pool.execute(
    'UPDATE games SET title = ?, date = ?, kickoff_time = ?, meeting_time = ?, info = ?, location_text = ?, venue_id = ?, opponent = ? WHERE id = ? AND team_id = ?',
    [title, date || null, kickoff_time || null, meeting_time || null, info || null, location_text || null, venue_id || null, opponent || null, gameId, teamId]
  );
  return result;
}

async function deleteGame(gameId, teamId) {
  const [result] = await pool.execute('DELETE FROM games WHERE id = ? AND team_id = ?', [gameId, teamId]);
  return result;
}

async function updateGameResult(gameId, resultMarkdown, teamId) {
  const [result] = await pool.execute(
    'UPDATE games SET result_markdown = ? WHERE id = ? AND team_id = ?',
    [resultMarkdown || null, gameId, teamId]
  );
  return result;
}

module.exports = {
  findGamesByTeamId,
  findGameById,
  createGame,
  updateGame,
  deleteGame,
  updateGameResult,
};
