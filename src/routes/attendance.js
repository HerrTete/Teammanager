'use strict';

const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireClubAccess, validateCsrf, verifyEventBelongsToClub } = require('../middleware/auth');
const { generateAttendanceListPDF } = require('../services/pdf');

const router = express.Router({ mergeParams: true });

const VALID_EVENT_TYPES = ['game', 'training'];

// GET /api/clubs/:clubId/events/:eventType/:eventId/attendance
router.get('/', requireAuth, requireClubAccess, async (req, res) => {
  const { eventType, eventId, clubId } = req.params;
  if (!VALID_EVENT_TYPES.includes(eventType)) {
    return res.status(400).json({ status: 'error', message: 'Ungültiger Eventtyp.' });
  }
  try {
    if (!(await verifyEventBelongsToClub(pool, eventType, eventId, clubId))) {
      return res.status(403).json({ status: 'error', message: 'Event gehört nicht zu diesem Verein.' });
    }
    const [attendance] = await pool.execute(
      'SELECT a.id, a.user_id, a.status, a.reminded, a.escalated, a.created_at, a.updated_at, u.username FROM attendance a INNER JOIN users u ON a.user_id = u.id WHERE a.event_type = ? AND a.event_id = ?',
      [eventType, eventId]
    );
    return res.json({ status: 'ok', attendance });
  } catch (err) {
    console.error('List attendance error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/clubs/:clubId/events/:eventType/:eventId/attendance - RSVP
router.post('/', requireAuth, validateCsrf, requireClubAccess, async (req, res) => {
  const { eventType, eventId, clubId } = req.params;
  const { status } = req.body || {};
  if (!VALID_EVENT_TYPES.includes(eventType)) {
    return res.status(400).json({ status: 'error', message: 'Ungültiger Eventtyp.' });
  }
  if (!status || !['accepted', 'declined'].includes(status)) {
    return res.status(400).json({ status: 'error', message: 'Status muss "accepted" oder "declined" sein.' });
  }
  try {
    if (!(await verifyEventBelongsToClub(pool, eventType, eventId, clubId))) {
      return res.status(403).json({ status: 'error', message: 'Event gehört nicht zu diesem Verein.' });
    }
    // Upsert attendance
    const [existing] = await pool.execute(
      'SELECT id FROM attendance WHERE user_id = ? AND event_type = ? AND event_id = ?',
      [req.session.userId, eventType, eventId]
    );
    if (existing.length > 0) {
      await pool.execute(
        'UPDATE attendance SET status = ? WHERE id = ?',
        [status, existing[0].id]
      );
    } else {
      await pool.execute(
        'INSERT INTO attendance (user_id, event_type, event_id, status) VALUES (?, ?, ?, ?)',
        [req.session.userId, eventType, eventId, status]
      );
    }
    return res.json({ status: 'ok', message: 'Rückmeldung gespeichert.' });
  } catch (err) {
    console.error('RSVP error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// GET /api/clubs/:clubId/events/:eventType/:eventId/attendance/export - PDF export
router.get('/export', requireAuth, requireClubAccess, async (req, res) => {
  const { eventType, eventId, clubId } = req.params;
  if (!VALID_EVENT_TYPES.includes(eventType)) {
    return res.status(400).json({ status: 'error', message: 'Ungültiger Eventtyp.' });
  }
  try {
    const tables = { game: 'games', training: 'trainings' };
    const table = tables[eventType];
    if (!(await verifyEventBelongsToClub(pool, eventType, eventId, clubId))) {
      return res.status(403).json({ status: 'error', message: 'Event gehört nicht zu diesem Verein.' });
    }
    const [events] = await pool.execute(`SELECT * FROM ${table} WHERE id = ?`, [eventId]);
    if (events.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Event nicht gefunden.' });
    }
    const [attendance] = await pool.execute(
      'SELECT a.status, u.username FROM attendance a INNER JOIN users u ON a.user_id = u.id WHERE a.event_type = ? AND a.event_id = ?',
      [eventType, eventId]
    );
    const [clubRows] = await pool.execute('SELECT logo FROM clubs WHERE id = ?', [clubId]);
    const clubLogo = clubRows.length > 0 ? clubRows[0].logo : null;

    const pdfBuffer = await generateAttendanceListPDF(events[0], attendance, clubLogo);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="attendance-${eventType}-${eventId}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('Attendance export error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

module.exports = router;
