'use strict';

const { pool } = require('../db');

async function findTeamsBySportId(sportId, clubId) {
  const [rows] = await pool.execute(
    'SELECT t.id, t.name, t.created_at FROM teams t INNER JOIN sports s ON t.sport_id = s.id WHERE t.sport_id = ? AND s.club_id = ? ORDER BY t.name',
    [sportId, clubId]
  );
  return rows;
}

async function findTeamById(teamId, sportId, clubId) {
  const [rows] = await pool.execute(
    'SELECT t.id, t.name, t.created_at FROM teams t INNER JOIN sports s ON t.sport_id = s.id WHERE t.id = ? AND t.sport_id = ? AND s.club_id = ?',
    [teamId, sportId, clubId]
  );
  return rows;
}

async function createTeam(sportId, name) {
  const [result] = await pool.execute('INSERT INTO teams (name, sport_id) VALUES (?, ?)', [name, sportId]);
  return result;
}

async function updateTeam(teamId, name, sportId, clubId) {
  const [result] = await pool.execute(
    'UPDATE teams t INNER JOIN sports s ON t.sport_id = s.id SET t.name = ? WHERE t.id = ? AND t.sport_id = ? AND s.club_id = ?',
    [name, teamId, sportId, clubId]
  );
  return result;
}

async function findTrainers(teamId) {
  const [rows] = await pool.execute(
    'SELECT tt.id, tt.user_id, u.username FROM team_trainers tt INNER JOIN users u ON tt.user_id = u.id WHERE tt.team_id = ?',
    [teamId]
  );
  return rows;
}

async function addTrainer(teamId, userId) {
  const [result] = await pool.execute('INSERT INTO team_trainers (team_id, user_id) VALUES (?, ?)', [teamId, userId]);
  return result;
}

async function findTrainerRole(userId, teamId) {
  const [rows] = await pool.execute(
    "SELECT id FROM user_roles WHERE user_id = ? AND role = 'Trainer' AND team_id = ?",
    [userId, teamId]
  );
  return rows;
}

async function insertTrainerRole(userId, clubId, sportId, teamId) {
  const [result] = await pool.execute(
    "INSERT INTO user_roles (user_id, role, club_id, sport_id, team_id) VALUES (?, 'Trainer', ?, ?, ?)",
    [userId, clubId, sportId, teamId]
  );
  return result;
}

async function removeTrainer(teamId, userId) {
  const [result] = await pool.execute('DELETE FROM team_trainers WHERE team_id = ? AND user_id = ?', [teamId, userId]);
  return result;
}

async function findPlayers(teamId) {
  const [rows] = await pool.execute(
    'SELECT p.id, p.user_id, p.jersey_number, u.username FROM players p INNER JOIN users u ON p.user_id = u.id WHERE p.team_id = ?',
    [teamId]
  );
  return rows;
}

async function addPlayer(teamId, userId, jerseyNumber) {
  const [result] = await pool.execute(
    'INSERT INTO players (user_id, team_id, jersey_number) VALUES (?, ?, ?)',
    [userId, teamId, jerseyNumber]
  );
  return result;
}

async function removePlayer(playerId, teamId) {
  const [result] = await pool.execute('DELETE FROM players WHERE id = ? AND team_id = ?', [playerId, teamId]);
  return result;
}

async function findSportByIdAndClub(sportId, clubId) {
  const [rows] = await pool.execute('SELECT id FROM sports WHERE id = ? AND club_id = ?', [sportId, clubId]);
  return rows;
}

module.exports = {
  findTeamsBySportId,
  findTeamById,
  createTeam,
  updateTeam,
  findTrainers,
  addTrainer,
  findTrainerRole,
  insertTrainerRole,
  removeTrainer,
  findPlayers,
  addPlayer,
  removePlayer,
  findSportByIdAndClub,
};
