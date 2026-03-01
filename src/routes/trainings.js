'use strict';

const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole, requireClubAccess, validateCsrf, verifyTeamBelongsToClub } = require('../middleware/auth');
const { marked } = require('marked');

const router = express.Router({ mergeParams: true });

// GET /api/clubs/:clubId/teams/:teamId/trainings
router.get('/', requireAuth, requireClubAccess, async (req, res) => {
  try {
    if (!(await verifyTeamBelongsToClub(pool, req.params.teamId, req.params.clubId))) {
      return res.status(403).json({ status: 'error', message: 'Team gehört nicht zu diesem Verein.' });
    }
    const [trainings] = await pool.execute(
      'SELECT t.id, t.title, t.date, t.time, t.location_text, t.venue_id, t.team_id, t.created_by, t.created_at FROM trainings t WHERE t.team_id = ? ORDER BY t.date, t.time',
      [req.params.teamId]
    );
    return res.json({ status: 'ok', trainings });
  } catch (err) {
    console.error('List trainings error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/clubs/:clubId/teams/:teamId/trainings
router.post('/', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  const { title, date, time, location_text, venue_id } = req.body || {};
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Titel ist erforderlich.' });
  }
  try {
    if (!(await verifyTeamBelongsToClub(pool, req.params.teamId, req.params.clubId))) {
      return res.status(403).json({ status: 'error', message: 'Team gehört nicht zu diesem Verein.' });
    }
    const [result] = await pool.execute(
      'INSERT INTO trainings (title, date, time, location_text, venue_id, team_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title.trim(), date || null, time || null, location_text || null, venue_id || null, req.params.teamId, req.session.userId]
    );
    return res.status(201).json({ status: 'ok', trainingId: result.insertId });
  } catch (err) {
    console.error('Create training error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// GET /api/clubs/:clubId/teams/:teamId/trainings/:trainingId
router.get('/:trainingId', requireAuth, requireClubAccess, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT t.*, v.name AS venue_name, v.address AS venue_address FROM trainings t LEFT JOIN venues v ON t.venue_id = v.id WHERE t.id = ? AND t.team_id = ?',
      [req.params.trainingId, req.params.teamId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Training nicht gefunden.' });
    }
    const training = rows[0];
    if (training.result_markdown) {
      training.result_html = marked(training.result_markdown);
    }
    return res.json({ status: 'ok', training });
  } catch (err) {
    console.error('Get training error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// PUT /api/clubs/:clubId/teams/:teamId/trainings/:trainingId
router.put('/:trainingId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  const { title, date, time, location_text, venue_id } = req.body || {};
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Titel ist erforderlich.' });
  }
  try {
    const [result] = await pool.execute(
      'UPDATE trainings SET title = ?, date = ?, time = ?, location_text = ?, venue_id = ? WHERE id = ? AND team_id = ?',
      [title.trim(), date || null, time || null, location_text || null, venue_id || null, req.params.trainingId, req.params.teamId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Training nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Training aktualisiert.' });
  } catch (err) {
    console.error('Update training error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// PUT /api/clubs/:clubId/teams/:teamId/trainings/:trainingId/result
router.put('/:trainingId/result', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  const { result_markdown } = req.body || {};
  try {
    const [result] = await pool.execute(
      'UPDATE trainings SET result_markdown = ? WHERE id = ? AND team_id = ?',
      [result_markdown || null, req.params.trainingId, req.params.teamId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Training nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Ergebnis aktualisiert.' });
  } catch (err) {
    console.error('Update training result error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// DELETE /api/clubs/:clubId/teams/:teamId/trainings/:trainingId
router.delete('/:trainingId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM trainings WHERE id = ? AND team_id = ?', [req.params.trainingId, req.params.teamId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Training nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Training gelöscht.' });
  } catch (err) {
    console.error('Delete training error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

module.exports = router;
