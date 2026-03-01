'use strict';

const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard
router.get('/', requireAuth, async (req, res) => {
  try {
    // Get user's clubs
    const [adminRoles] = await pool.execute(
      "SELECT id FROM user_roles WHERE user_id = ? AND role = 'PortalAdmin'",
      [req.session.userId]
    );
    let clubs;
    if (adminRoles.length > 0) {
      [clubs] = await pool.execute('SELECT id, name FROM clubs ORDER BY name');
    } else {
      [clubs] = await pool.execute(
        'SELECT c.id, c.name FROM clubs c INNER JOIN club_members cm ON c.id = cm.club_id WHERE cm.user_id = ? ORDER BY c.name',
        [req.session.userId]
      );
    }

    // Get unread notifications count
    const [notifCount] = await pool.execute(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.session.userId]
    );

    // Get upcoming events (games and trainings for user's teams)
    const [upcomingGames] = await pool.execute(
      `SELECT g.id, g.title, g.date, g.time, g.opponent, 'game' AS event_type, t.name AS team_name
       FROM games g
       INNER JOIN teams t ON g.team_id = t.id
       INNER JOIN players p ON p.team_id = t.id
       WHERE p.user_id = ? AND g.date >= CURDATE()
       ORDER BY g.date, g.time LIMIT 10`,
      [req.session.userId]
    );
    const [upcomingTrainings] = await pool.execute(
      `SELECT tr.id, tr.title, tr.date, tr.time, 'training' AS event_type, t.name AS team_name
       FROM trainings tr
       INNER JOIN teams t ON tr.team_id = t.id
       INNER JOIN players p ON p.team_id = t.id
       WHERE p.user_id = ? AND tr.date >= CURDATE()
       ORDER BY tr.date, tr.time LIMIT 10`,
      [req.session.userId]
    );

    return res.json({
      status: 'ok',
      clubs,
      unreadNotifications: notifCount[0].count,
      upcomingEvents: [...upcomingGames, ...upcomingTrainings].sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time || '00:00:00'}`);
        const dateB = new Date(`${b.date}T${b.time || '00:00:00'}`);
        return dateA - dateB;
      }).slice(0, 10),
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

module.exports = router;
