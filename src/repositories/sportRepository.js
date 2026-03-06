'use strict';

const { pool } = require('../db');

async function findSportsByClubId(clubId) {
  const [rows] = await pool.execute(
    'SELECT id, name, created_at FROM sports WHERE club_id = ? ORDER BY name',
    [clubId]
  );
  return rows;
}

async function findSportById(sportId) {
  const [rows] = await pool.execute('SELECT id, name, club_id, created_at FROM sports WHERE id = ?', [sportId]);
  return rows;
}

async function createSport(clubId, name) {
  const [result] = await pool.execute('INSERT INTO sports (name, club_id) VALUES (?, ?)', [name, clubId]);
  return result;
}

async function updateSport(sportId, name, clubId) {
  const [result] = await pool.execute(
    'UPDATE sports SET name = ? WHERE id = ? AND club_id = ?',
    [name, sportId, clubId]
  );
  return result;
}

async function deleteSport(sportId, clubId) {
  const [result] = await pool.execute('DELETE FROM sports WHERE id = ? AND club_id = ?', [sportId, clubId]);
  return result;
}

module.exports = {
  findSportsByClubId,
  findSportById,
  createSport,
  updateSport,
  deleteSport,
};
