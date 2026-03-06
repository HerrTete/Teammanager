'use strict';

const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole, requireClubAccess, validateCsrf, verifyTeamBelongsToClub } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /api/clubs/:clubId/teams/:teamId/players
router.get('/', requireAuth, requireClubAccess, async (req, res) => {
  try {
    if (!(await verifyTeamBelongsToClub(pool, req.params.teamId, req.params.clubId))) {
      return res.status(403).json({ status: 'error', message: 'Team gehört nicht zu diesem Verein.' });
    }
    const [players] = await pool.execute(
      'SELECT p.id, p.user_id, p.name, p.jersey_number, p.managed_by, p.created_at, u.username, m.username AS managed_by_username FROM players p LEFT JOIN users u ON p.user_id = u.id LEFT JOIN users m ON p.managed_by = m.id WHERE p.team_id = ? ORDER BY p.jersey_number',
      [req.params.teamId]
    );
    return res.json({ status: 'ok', players });
  } catch (err) {
    console.error('List players error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/clubs/:clubId/teams/:teamId/players
router.post('/', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  const { userId, name, jerseyNumber, managedBy } = req.body || {};
  if (!userId && (!name || typeof name !== 'string' || name.trim().length === 0)) {
    return res.status(400).json({ status: 'error', message: 'Benutzer-ID oder Spielername ist erforderlich.' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO players (user_id, name, team_id, jersey_number, managed_by) VALUES (?, ?, ?, ?, ?)',
      [userId || null, name ? name.trim() : null, req.params.teamId, jerseyNumber || null, managedBy || null]
    );
    return res.status(201).json({ status: 'ok', playerId: result.insertId });
  } catch (err) {
    console.error('Add player error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// PUT /api/clubs/:clubId/teams/:teamId/players/:playerId
router.put('/:playerId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  const { jerseyNumber, name, managedBy } = req.body || {};
  try {
    const [result] = await pool.execute(
      'UPDATE players SET jersey_number = ?, name = ?, managed_by = ? WHERE id = ? AND team_id = ?',
      [jerseyNumber !== undefined ? jerseyNumber : null, name || null, managedBy || null, req.params.playerId, req.params.teamId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Spieler nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Spieler aktualisiert.' });
  } catch (err) {
    console.error('Update player error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// DELETE /api/clubs/:clubId/teams/:teamId/players/:playerId
router.delete('/:playerId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM players WHERE id = ? AND team_id = ?', [req.params.playerId, req.params.teamId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Spieler nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Spieler entfernt.' });
  } catch (err) {
    console.error('Remove player error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

module.exports = router;
