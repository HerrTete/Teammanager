'use strict';

const { pool } = require('../db');

async function findAllClubs() {
  const [rows] = await pool.execute('SELECT id, name, created_at FROM clubs ORDER BY name');
  return rows;
}

async function findClubsByUserId(userId) {
  const [rows] = await pool.execute(
    'SELECT c.id, c.name, c.created_at FROM clubs c INNER JOIN club_members cm ON c.id = cm.club_id WHERE cm.user_id = ? ORDER BY c.name',
    [userId]
  );
  return rows;
}

async function findClubById(clubId) {
  const [rows] = await pool.execute('SELECT id, name, created_at FROM clubs WHERE id = ?', [clubId]);
  return rows;
}

async function createClub(name) {
  const [result] = await pool.execute('INSERT INTO clubs (name) VALUES (?)', [name]);
  return result;
}

async function updateClub(clubId, name) {
  const [result] = await pool.execute('UPDATE clubs SET name = ? WHERE id = ?', [name, clubId]);
  return result;
}

async function updateClubLogo(clubId, logo, logoMime) {
  const [result] = await pool.execute('UPDATE clubs SET logo = ?, logo_mime = ? WHERE id = ?', [logo, logoMime, clubId]);
  return result;
}

async function findClubLogo(clubId) {
  const [rows] = await pool.execute('SELECT logo, logo_mime FROM clubs WHERE id = ?', [clubId]);
  return rows;
}

module.exports = {
  findAllClubs,
  findClubsByUserId,
  findClubById,
  createClub,
  updateClub,
  updateClubLogo,
  findClubLogo,
};
