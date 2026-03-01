'use strict';

const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireRole, requireClubAccess, validateCsrf } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /api/clubs/:clubId/sports/:sportId/teams
router.get('/', requireAuth, requireClubAccess, async (req, res) => {
  try {
    const [teams] = await pool.execute(
      'SELECT t.id, t.name, t.created_at FROM teams t INNER JOIN sports s ON t.sport_id = s.id WHERE t.sport_id = ? AND s.club_id = ? ORDER BY t.name',
      [req.params.sportId, req.params.clubId]
    );
    return res.json({ status: 'ok', teams });
  } catch (err) {
    console.error('List teams error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/clubs/:clubId/sports/:sportId/teams
router.post('/', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin']), async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Teamname ist erforderlich.' });
  }
  try {
    // Verify sport belongs to club
    const [sportRows] = await pool.execute('SELECT id FROM sports WHERE id = ? AND club_id = ?', [req.params.sportId, req.params.clubId]);
    if (sportRows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Sportart nicht gefunden.' });
    }
    const [result] = await pool.execute('INSERT INTO teams (name, sport_id) VALUES (?, ?)', [name.trim(), req.params.sportId]);
    return res.status(201).json({ status: 'ok', teamId: result.insertId });
  } catch (err) {
    console.error('Create team error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// GET /api/clubs/:clubId/sports/:sportId/teams/:teamId
router.get('/:teamId', requireAuth, requireClubAccess, async (req, res) => {
  try {
    const [teams] = await pool.execute(
      'SELECT t.id, t.name, t.created_at FROM teams t INNER JOIN sports s ON t.sport_id = s.id WHERE t.id = ? AND t.sport_id = ? AND s.club_id = ?',
      [req.params.teamId, req.params.sportId, req.params.clubId]
    );
    if (teams.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Team nicht gefunden.' });
    }
    const team = teams[0];

    const [trainers] = await pool.execute(
      'SELECT tt.id, tt.user_id, u.username FROM team_trainers tt INNER JOIN users u ON tt.user_id = u.id WHERE tt.team_id = ?',
      [req.params.teamId]
    );
    const [players] = await pool.execute(
      'SELECT p.id, p.user_id, p.jersey_number, u.username FROM players p INNER JOIN users u ON p.user_id = u.id WHERE p.team_id = ?',
      [req.params.teamId]
    );

    return res.json({ status: 'ok', team: { ...team, trainers, players } });
  } catch (err) {
    console.error('Get team error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// PUT /api/clubs/:clubId/sports/:sportId/teams/:teamId
router.put('/:teamId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Teamname ist erforderlich.' });
  }
  try {
    const [result] = await pool.execute(
      'UPDATE teams t INNER JOIN sports s ON t.sport_id = s.id SET t.name = ? WHERE t.id = ? AND t.sport_id = ? AND s.club_id = ?',
      [name.trim(), req.params.teamId, req.params.sportId, req.params.clubId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Team nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Team aktualisiert.' });
  } catch (err) {
    console.error('Update team error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/clubs/:clubId/sports/:sportId/teams/:teamId/trainers
router.post('/:teamId/trainers', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin']), async (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ status: 'error', message: 'Benutzer-ID ist erforderlich.' });
  }
  try {
    await pool.execute('INSERT INTO team_trainers (team_id, user_id) VALUES (?, ?)', [req.params.teamId, userId]);
    // Assign Trainer role if not existing
    const [existing] = await pool.execute(
      "SELECT id FROM user_roles WHERE user_id = ? AND role = 'Trainer' AND team_id = ?",
      [userId, req.params.teamId]
    );
    if (existing.length === 0) {
      await pool.execute(
        "INSERT INTO user_roles (user_id, role, club_id, sport_id, team_id) VALUES (?, 'Trainer', ?, ?, ?)",
        [userId, req.params.clubId, req.params.sportId, req.params.teamId]
      );
    }
    return res.status(201).json({ status: 'ok', message: 'Trainer hinzugefügt.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'error', message: 'Trainer bereits zugewiesen.' });
    }
    console.error('Add trainer error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// DELETE /api/clubs/:clubId/sports/:sportId/teams/:teamId/trainers/:userId
router.delete('/:teamId/trainers/:userId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin']), async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM team_trainers WHERE team_id = ? AND user_id = ?', [req.params.teamId, req.params.userId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Trainer nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Trainer entfernt.' });
  } catch (err) {
    console.error('Remove trainer error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/clubs/:clubId/sports/:sportId/teams/:teamId/players
router.post('/:teamId/players', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  const { userId, jerseyNumber } = req.body || {};
  if (!userId) {
    return res.status(400).json({ status: 'error', message: 'Benutzer-ID ist erforderlich.' });
  }
  try {
    await pool.execute('INSERT INTO players (user_id, team_id, jersey_number) VALUES (?, ?, ?)', [userId, req.params.teamId, jerseyNumber || null]);
    return res.status(201).json({ status: 'ok', message: 'Spieler hinzugefügt.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'error', message: 'Spieler bereits im Team.' });
    }
    console.error('Add player error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// DELETE /api/clubs/:clubId/sports/:sportId/teams/:teamId/players/:playerId
router.delete('/:teamId/players/:playerId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
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
