'use strict';

const express = require('express');
const { pool } = require('../db');
const gameRepository = require('../repositories/gameRepository');
const { requireAuth, requireRole, requireClubAccess, validateCsrf, verifyTeamBelongsToClub } = require('../middleware/auth');
const { marked } = require('marked');

const router = express.Router({ mergeParams: true });

// GET /api/clubs/:clubId/teams/:teamId/games
router.get('/', requireAuth, requireClubAccess, async (req, res) => {
  try {
    if (!(await verifyTeamBelongsToClub(pool, req.params.teamId, req.params.clubId))) {
      return res.status(403).json({ status: 'error', message: 'Team gehört nicht zu diesem Verein.' });
    }
    const games = await gameRepository.findGamesByTeamId(req.params.teamId);
    return res.json({ status: 'ok', games });
  } catch (err) {
    console.error('List games error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/clubs/:clubId/teams/:teamId/games
router.post('/', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  const { title, date, kickoff_time, meeting_time, info, location_text, venue_id, opponent } = req.body || {};
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Titel ist erforderlich.' });
  }
  try {
    if (!(await verifyTeamBelongsToClub(pool, req.params.teamId, req.params.clubId))) {
      return res.status(403).json({ status: 'error', message: 'Team gehört nicht zu diesem Verein.' });
    }
    const result = await gameRepository.createGame({
      title: title.trim(),
      date,
      kickoff_time,
      meeting_time,
      info,
      location_text,
      venue_id,
      opponent,
      team_id: req.params.teamId,
      created_by: req.session.userId,
    });
    return res.status(201).json({ status: 'ok', gameId: result.insertId });
  } catch (err) {
    console.error('Create game error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// GET /api/clubs/:clubId/teams/:teamId/games/:gameId
router.get('/:gameId', requireAuth, requireClubAccess, async (req, res) => {
  try {
    const rows = await gameRepository.findGameById(req.params.gameId, req.params.teamId);
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
  const { title, date, kickoff_time, meeting_time, info, location_text, venue_id, opponent } = req.body || {};
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Titel ist erforderlich.' });
  }
  try {
    const result = await gameRepository.updateGame(req.params.gameId, {
      title: title.trim(),
      date,
      kickoff_time,
      meeting_time,
      info,
      location_text,
      venue_id,
      opponent,
    }, req.params.teamId);
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
    const result = await gameRepository.updateGameResult(req.params.gameId, result_markdown, req.params.teamId);
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
    const result = await gameRepository.deleteGame(req.params.gameId, req.params.teamId);
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
