'use strict';

const { pool } = require('../db');

async function findVenuesByClubId(clubId) {
  const [rows] = await pool.execute(
    'SELECT id, name, zip_code, street, house_number, city, link, google_maps_link, created_at FROM venues WHERE club_id = ? ORDER BY name',
    [clubId]
  );
  return rows;
}

async function findVenueById(venueId, clubId) {
  const [rows] = await pool.execute(
    'SELECT id, name, zip_code, street, house_number, city, link, google_maps_link, created_at FROM venues WHERE id = ? AND club_id = ?',
    [venueId, clubId]
  );
  return rows;
}

async function createVenue(clubId, data) {
  const { name, zip_code, street, house_number, city, link, google_maps_link } = data;
  const [result] = await pool.execute(
    'INSERT INTO venues (name, zip_code, street, house_number, city, link, google_maps_link, club_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [name, zip_code || null, street || null, house_number || null, city || null, link || null, google_maps_link || null, clubId]
  );
  return result;
}

async function updateVenue(venueId, data, clubId) {
  const { name, zip_code, street, house_number, city, link, google_maps_link } = data;
  const [result] = await pool.execute(
    'UPDATE venues SET name = ?, zip_code = ?, street = ?, house_number = ?, city = ?, link = ?, google_maps_link = ? WHERE id = ? AND club_id = ?',
    [name, zip_code || null, street || null, house_number || null, city || null, link || null, google_maps_link || null, venueId, clubId]
  );
  return result;
}

async function deleteVenue(venueId, clubId) {
  const [result] = await pool.execute('DELETE FROM venues WHERE id = ? AND club_id = ?', [venueId, clubId]);
  return result;
}

module.exports = {
  findVenuesByClubId,
  findVenueById,
  createVenue,
  updateVenue,
  deleteVenue,
};
