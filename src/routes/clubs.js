'use strict';

const express = require('express');
const multer = require('multer');
const clubRepository = require('../repositories/clubRepository');
const roleRepository = require('../repositories/roleRepository');
const { requireAuth, requireRole, requireClubAccess, validateCsrf } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/clubs - list user's clubs
router.get('/', requireAuth, async (req, res) => {
  try {
    const isAdmin = await roleRepository.isPortalAdmin(req.session.userId);
    let clubs;
    if (isAdmin) {
      clubs = await clubRepository.findAllClubs();
    } else {
      clubs = await clubRepository.findClubsByUserId(req.session.userId);
    }
    for (const club of clubs) {
      club.role = await roleRepository.getHighestRoleForClub(req.session.userId, club.id);
    }
    return res.json({ status: 'ok', clubs, isPortalAdmin: isAdmin });
  } catch (err) {
    console.error('List clubs error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/clubs - create club (PortalAdmin only)
router.post('/', requireAuth, validateCsrf, requireRole(['PortalAdmin']), async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Vereinsname ist erforderlich.' });
  }
  try {
    const result = await clubRepository.createClub(name.trim());
    return res.status(201).json({ status: 'ok', clubId: result.insertId });
  } catch (err) {
    console.error('Create club error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// GET /api/clubs/:clubId - get club details
router.get('/:clubId', requireAuth, requireClubAccess, async (req, res) => {
  try {
    const rows = await clubRepository.findClubById(req.params.clubId);
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Verein nicht gefunden.' });
    }
    const club = rows[0];
    club.role = await roleRepository.getHighestRoleForClub(req.session.userId, req.params.clubId);
    return res.json({ status: 'ok', club });
  } catch (err) {
    console.error('Get club error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// PUT /api/clubs/:clubId - update club (VereinsAdmin)
router.put('/:clubId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin']), async (req, res) => {
  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Vereinsname ist erforderlich.' });
  }
  try {
    await clubRepository.updateClub(req.params.clubId, name.trim());
    return res.json({ status: 'ok', message: 'Verein aktualisiert.' });
  } catch (err) {
    console.error('Update club error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/clubs/:clubId/logo - upload club logo (VereinsAdmin)
router.post('/:clubId/logo', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin']), upload.single('logo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: 'error', message: 'Keine Datei hochgeladen.' });
  }
  try {
    await clubRepository.updateClubLogo(req.params.clubId, req.file.buffer, req.file.mimetype);
    return res.json({ status: 'ok', message: 'Logo hochgeladen.' });
  } catch (err) {
    console.error('Upload logo error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// GET /api/clubs/:clubId/logo - get club logo
router.get('/:clubId/logo', async (req, res) => {
  try {
    const rows = await clubRepository.findClubLogo(req.params.clubId);
    if (rows.length === 0 || !rows[0].logo) {
      return res.status(404).json({ status: 'error', message: 'Logo nicht gefunden.' });
    }
    res.set('Content-Type', rows[0].logo_mime || 'image/png');
    return res.send(rows[0].logo);
  } catch (err) {
    console.error('Get logo error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

module.exports = router;
