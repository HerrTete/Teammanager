'use strict';

const express = require('express');
const { pool } = require('../db');
const trainingRepository = require('../repositories/trainingRepository');
const { requireAuth, requireRole, requireClubAccess, validateCsrf, verifyTeamBelongsToClub } = require('../middleware/auth');
const { marked } = require('marked');

const router = express.Router({ mergeParams: true });

// GET /api/clubs/:clubId/teams/:teamId/trainings
router.get('/', requireAuth, requireClubAccess, async (req, res) => {
  try {
    if (!(await verifyTeamBelongsToClub(pool, req.params.teamId, req.params.clubId))) {
      return res.status(403).json({ status: 'error', message: 'Team gehört nicht zu diesem Verein.' });
    }
    const trainings = await trainingRepository.findTrainingsByTeamId(req.params.teamId);
    return res.json({ status: 'ok', trainings });
  } catch (err) {
    console.error('List trainings error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/clubs/:clubId/teams/:teamId/trainings
router.post('/', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  const { title, date, time, location_text, venue_id, sport_id, additional_team_ids } = req.body || {};
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Titel ist erforderlich.' });
  }
  try {
    if (!(await verifyTeamBelongsToClub(pool, req.params.teamId, req.params.clubId))) {
      return res.status(403).json({ status: 'error', message: 'Team gehört nicht zu diesem Verein.' });
    }
    const result = await trainingRepository.createTraining({
      title: title.trim(),
      date,
      time,
      location_text,
      venue_id,
      sport_id,
      team_id: req.params.teamId,
      created_by: req.session.userId,
    });
    await trainingRepository.addTrainingTeam(result.insertId, req.params.teamId);
    const skippedTeamIds = [];
    if (Array.isArray(additional_team_ids)) {
      for (const additionalTeamId of additional_team_ids) {
        if (!(await verifyTeamBelongsToClub(pool, additionalTeamId, req.params.clubId))) {
          skippedTeamIds.push(additionalTeamId);
          continue;
        }
        await trainingRepository.addTrainingTeam(result.insertId, additionalTeamId);
      }
    }
    const response = { status: 'ok', trainingId: result.insertId };
    if (skippedTeamIds.length > 0) {
      response.skippedTeamIds = skippedTeamIds;
    }
    return res.status(201).json(response);
  } catch (err) {
    console.error('Create training error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// GET /api/clubs/:clubId/teams/:teamId/trainings/:trainingId
router.get('/:trainingId', requireAuth, requireClubAccess, async (req, res) => {
  try {
    const rows = await trainingRepository.findTrainingById(req.params.trainingId, req.params.teamId);
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Training nicht gefunden.' });
    }
    const training = rows[0];
    if (training.result_markdown) {
      training.result_html = marked(training.result_markdown);
    }
    const teams = await trainingRepository.findTrainingTeams(req.params.trainingId);
    training.teams = teams;
    return res.json({ status: 'ok', training });
  } catch (err) {
    console.error('Get training error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// PUT /api/clubs/:clubId/teams/:teamId/trainings/:trainingId
router.put('/:trainingId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  const { title, date, time, location_text, venue_id, sport_id } = req.body || {};
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Titel ist erforderlich.' });
  }
  try {
    const result = await trainingRepository.updateTraining(req.params.trainingId, {
      title: title.trim(),
      date,
      time,
      location_text,
      venue_id,
      sport_id,
    }, req.params.teamId);
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
    const result = await trainingRepository.updateTrainingResult(req.params.trainingId, result_markdown, req.params.teamId);
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
    const result = await trainingRepository.deleteTraining(req.params.trainingId, req.params.teamId);
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
