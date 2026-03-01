'use strict';

const express = require('express');
const multer = require('multer');
const { pool } = require('../db');
const { requireAuth, requireRole, requireClubAccess, validateCsrf } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/clubs - list user's clubs
router.get('/', requireAuth, async (req, res) => {
  try {
    // PortalAdmin sees all clubs
    const [adminRoles] = await pool.execute(
      "SELECT id FROM user_roles WHERE user_id = ? AND role = 'PortalAdmin'",
      [req.session.userId]
    );
    let clubs;
    if (adminRoles.length > 0) {
      [clubs] = await pool.execute('SELECT id, name, created_at FROM clubs ORDER BY name');
    } else {
      [clubs] = await pool.execute(
        'SELECT c.id, c.name, c.created_at FROM clubs c INNER JOIN club_members cm ON c.id = cm.club_id WHERE cm.user_id = ? ORDER BY c.name',
        [req.session.userId]
      );
    }
    return res.json({ status: 'ok', clubs });
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
    const [result] = await pool.execute('INSERT INTO clubs (name) VALUES (?)', [name.trim()]);
    return res.status(201).json({ status: 'ok', clubId: result.insertId });
  } catch (err) {
    console.error('Create club error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// GET /api/clubs/:clubId - get club details
router.get('/:clubId', requireAuth, requireClubAccess, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name, created_at FROM clubs WHERE id = ?', [req.params.clubId]);
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Verein nicht gefunden.' });
    }
    return res.json({ status: 'ok', club: rows[0] });
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
    await pool.execute('UPDATE clubs SET name = ? WHERE id = ?', [name.trim(), req.params.clubId]);
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
    await pool.execute('UPDATE clubs SET logo = ?, logo_mime = ? WHERE id = ?', [req.file.buffer, req.file.mimetype, req.params.clubId]);
    return res.json({ status: 'ok', message: 'Logo hochgeladen.' });
  } catch (err) {
    console.error('Upload logo error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// GET /api/clubs/:clubId/logo - get club logo
router.get('/:clubId/logo', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT logo, logo_mime FROM clubs WHERE id = ?', [req.params.clubId]);
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
