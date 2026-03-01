'use strict';

const express = require('express');
const multer = require('multer');
const { pool } = require('../db');
const { requireAuth, requireRole, requireClubAccess, validateCsrf } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const VALID_EVENT_TYPES = ['game', 'training'];

// POST /api/clubs/:clubId/events/:eventType/:eventId/photos
router.post('/', requireAuth, validateCsrf, requireClubAccess, upload.single('photo'), async (req, res) => {
  const { eventType, eventId } = req.params;
  if (!VALID_EVENT_TYPES.includes(eventType)) {
    return res.status(400).json({ status: 'error', message: 'Ungültiger Eventtyp.' });
  }
  if (!req.file) {
    return res.status(400).json({ status: 'error', message: 'Keine Datei hochgeladen.' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO photos (event_type, event_id, data, mime_type, filename, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)',
      [eventType, eventId, req.file.buffer, req.file.mimetype, req.file.originalname, req.session.userId]
    );
    return res.status(201).json({ status: 'ok', photoId: result.insertId });
  } catch (err) {
    console.error('Upload photo error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// GET /api/clubs/:clubId/events/:eventType/:eventId/photos
router.get('/', requireAuth, requireClubAccess, async (req, res) => {
  const { eventType, eventId } = req.params;
  if (!VALID_EVENT_TYPES.includes(eventType)) {
    return res.status(400).json({ status: 'error', message: 'Ungültiger Eventtyp.' });
  }
  try {
    const [photos] = await pool.execute(
      'SELECT p.id, p.filename, p.mime_type, p.uploaded_by, p.created_at, u.username AS uploader FROM photos p INNER JOIN users u ON p.uploaded_by = u.id WHERE p.event_type = ? AND p.event_id = ? ORDER BY p.created_at',
      [eventType, eventId]
    );
    return res.json({ status: 'ok', photos });
  } catch (err) {
    console.error('List photos error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

module.exports = router;
