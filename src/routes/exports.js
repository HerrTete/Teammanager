'use strict';

const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireClubAccess } = require('../middleware/auth');
const { generateEventICal } = require('../services/ical');
const { generateSchedulePDF, generateAttendanceListPDF } = require('../services/pdf');

const router = express.Router({ mergeParams: true });

// GET /api/clubs/:clubId/teams/:teamId/schedule/ical
router.get('/teams/:teamId/schedule/ical', requireAuth, requireClubAccess, async (req, res) => {
  try {
    const [games] = await pool.execute(
      'SELECT g.*, v.address AS venue_address FROM games g LEFT JOIN venues v ON g.venue_id = v.id WHERE g.team_id = ? ORDER BY g.date, g.time',
      [req.params.teamId]
    );
    const [trainings] = await pool.execute(
      'SELECT t.*, v.address AS venue_address FROM trainings t LEFT JOIN venues v ON t.venue_id = v.id WHERE t.team_id = ? ORDER BY t.date, t.time',
      [req.params.teamId]
    );

    const ical = require('ical-generator');
    const calendar = ical.default({ name: 'Teammanager Schedule' });

    const allEvents = [...games, ...trainings];
    for (const event of allEvents) {
      if (!event.date) continue;
      const startDate = new Date(`${event.date}T${event.time || '00:00:00'}`);
      const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
      calendar.createEvent({
        start: startDate,
        end: endDate,
        summary: event.title,
        location: event.location_text || event.venue_address || '',
        description: event.opponent ? `Gegner: ${event.opponent}` : '',
      });
    }

    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'attachment; filename="schedule.ics"');
    return res.send(calendar.toString());
  } catch (err) {
    console.error('iCal export error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// GET /api/clubs/:clubId/teams/:teamId/schedule/pdf
router.get('/teams/:teamId/schedule/pdf', requireAuth, requireClubAccess, async (req, res) => {
  try {
    const [games] = await pool.execute(
      'SELECT * FROM games WHERE team_id = ? ORDER BY date, time',
      [req.params.teamId]
    );
    const [clubRows] = await pool.execute('SELECT logo FROM clubs WHERE id = ?', [req.params.clubId]);
    const clubLogo = clubRows.length > 0 ? clubRows[0].logo : null;

    const pdfBuffer = await generateSchedulePDF(games, clubLogo);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="schedule.pdf"');
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF export error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// GET /api/clubs/:clubId/events/:eventType/:eventId/attendance/pdf
router.get('/events/:eventType/:eventId/attendance/pdf', requireAuth, requireClubAccess, async (req, res) => {
  const { eventType, eventId, clubId } = req.params;
  if (!['game', 'training'].includes(eventType)) {
    return res.status(400).json({ status: 'error', message: 'Ungültiger Eventtyp.' });
  }
  try {
    const table = eventType === 'game' ? 'games' : 'trainings';
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
    console.error('Attendance PDF error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

module.exports = router;
