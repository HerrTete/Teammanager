'use strict';

const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole, requireClubAccess, validateCsrf } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /api/clubs/:clubId/sports
router.get('/', requireAuth, requireClubAccess, async (req, res) => {
  try {
    const [sports] = await pool.execute('SELECT id, name, created_at FROM sports WHERE club_id = ? ORDER BY name', [req.params.clubId]);
    return res.json({ status: 'ok', sports });
  } catch (err) {
    console.error('List sports error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/clubs/:clubId/sports
router.post('/', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin']), async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Sportartname ist erforderlich.' });
  }
  try {
    const [result] = await pool.execute('INSERT INTO sports (name, club_id) VALUES (?, ?)', [name.trim(), req.params.clubId]);
    return res.status(201).json({ status: 'ok', sportId: result.insertId });
  } catch (err) {
    console.error('Create sport error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// PUT /api/clubs/:clubId/sports/:sportId
router.put('/:sportId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin']), async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Sportartname ist erforderlich.' });
  }
  try {
    const [result] = await pool.execute('UPDATE sports SET name = ? WHERE id = ? AND club_id = ?', [name.trim(), req.params.sportId, req.params.clubId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Sportart nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Sportart aktualisiert.' });
  } catch (err) {
    console.error('Update sport error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// DELETE /api/clubs/:clubId/sports/:sportId
router.delete('/:sportId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin']), async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM sports WHERE id = ? AND club_id = ?', [req.params.sportId, req.params.clubId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Sportart nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Sportart gelöscht.' });
  } catch (err) {
    console.error('Delete sport error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

module.exports = router;
