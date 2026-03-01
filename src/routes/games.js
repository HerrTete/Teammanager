'use strict';

const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole, requireClubAccess, validateCsrf } = require('../middleware/auth');
const { marked } = require('marked');

const router = express.Router({ mergeParams: true });

// GET /api/clubs/:clubId/teams/:teamId/games
router.get('/', requireAuth, requireClubAccess, async (req, res) => {
  try {
    const [games] = await pool.execute(
      'SELECT g.id, g.title, g.date, g.time, g.location_text, g.venue_id, g.opponent, g.team_id, g.created_by, g.created_at FROM games g WHERE g.team_id = ? ORDER BY g.date, g.time',
      [req.params.teamId]
    );
    return res.json({ status: 'ok', games });
  } catch (err) {
    console.error('List games error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/clubs/:clubId/teams/:teamId/games
router.post('/', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  const { title, date, time, location_text, venue_id, opponent } = req.body || {};
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Titel ist erforderlich.' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO games (title, date, time, location_text, venue_id, opponent, team_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title.trim(), date || null, time || null, location_text || null, venue_id || null, opponent || null, req.params.teamId, req.session.userId]
    );
    return res.status(201).json({ status: 'ok', gameId: result.insertId });
  } catch (err) {
    console.error('Create game error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// GET /api/clubs/:clubId/teams/:teamId/games/:gameId
router.get('/:gameId', requireAuth, requireClubAccess, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT g.*, v.name AS venue_name, v.address AS venue_address FROM games g LEFT JOIN venues v ON g.venue_id = v.id WHERE g.id = ? AND g.team_id = ?',
      [req.params.gameId, req.params.teamId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Spiel nicht gefunden.' });
    }
    const game = rows[0];
    if (game.result_markdown) {
      game.result_html = marked(game.result_markdown);
    }
    return res.json({ status: 'ok', game });
  } catch (err) {
    console.error('Get game error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// PUT /api/clubs/:clubId/teams/:teamId/games/:gameId
router.put('/:gameId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  const { title, date, time, location_text, venue_id, opponent } = req.body || {};
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Titel ist erforderlich.' });
  }
  try {
    const [result] = await pool.execute(
      'UPDATE games SET title = ?, date = ?, time = ?, location_text = ?, venue_id = ?, opponent = ? WHERE id = ? AND team_id = ?',
      [title.trim(), date || null, time || null, location_text || null, venue_id || null, opponent || null, req.params.gameId, req.params.teamId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Spiel nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Spiel aktualisiert.' });
  } catch (err) {
    console.error('Update game error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// PUT /api/clubs/:clubId/teams/:teamId/games/:gameId/result
router.put('/:gameId/result', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  const { result_markdown } = req.body || {};
  try {
    const [result] = await pool.execute(
      'UPDATE games SET result_markdown = ? WHERE id = ? AND team_id = ?',
      [result_markdown || null, req.params.gameId, req.params.teamId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Spiel nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Ergebnis aktualisiert.' });
  } catch (err) {
    console.error('Update game result error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// DELETE /api/clubs/:clubId/teams/:teamId/games/:gameId
router.delete('/:gameId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM games WHERE id = ? AND team_id = ?', [req.params.gameId, req.params.teamId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Spiel nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Spiel gelöscht.' });
  } catch (err) {
    console.error('Delete game error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

module.exports = router;
