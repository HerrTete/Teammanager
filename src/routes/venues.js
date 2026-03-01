'use strict';

const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole, requireClubAccess, validateCsrf } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /api/clubs/:clubId/venues
router.get('/', requireAuth, requireClubAccess, async (req, res) => {
  try {
    const [venues] = await pool.execute(
      'SELECT id, name, address, coordinates, map_link, created_at FROM venues WHERE club_id = ? ORDER BY name',
      [req.params.clubId]
    );
    return res.json({ status: 'ok', venues });
  } catch (err) {
    console.error('List venues error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/clubs/:clubId/venues
router.post('/', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  const { name, address, coordinates, map_link } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Name ist erforderlich.' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO venues (name, address, coordinates, map_link, club_id) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), address || null, coordinates || null, map_link || null, req.params.clubId]
    );
    return res.status(201).json({ status: 'ok', venueId: result.insertId });
  } catch (err) {
    console.error('Create venue error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// PUT /api/clubs/:clubId/venues/:venueId
router.put('/:venueId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  const { name, address, coordinates, map_link } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Name ist erforderlich.' });
  }
  try {
    const [result] = await pool.execute(
      'UPDATE venues SET name = ?, address = ?, coordinates = ?, map_link = ? WHERE id = ? AND club_id = ?',
      [name.trim(), address || null, coordinates || null, map_link || null, req.params.venueId, req.params.clubId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Spielstätte nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Spielstätte aktualisiert.' });
  } catch (err) {
    console.error('Update venue error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// DELETE /api/clubs/:clubId/venues/:venueId
router.delete('/:venueId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin']), async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM venues WHERE id = ? AND club_id = ?', [req.params.venueId, req.params.clubId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Spielstätte nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Spielstätte gelöscht.' });
  } catch (err) {
    console.error('Delete venue error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

module.exports = router;
