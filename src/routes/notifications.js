'use strict';

const express = require('express');
const { pool } = require('../db');
const { requireAuth, validateCsrf } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const [notifications] = await pool.execute(
      'SELECT id, type, title, message, reference_type, reference_id, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [req.session.userId]
    );
    return res.json({ status: 'ok', notifications });
  } catch (err) {
    console.error('List notifications error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', requireAuth, validateCsrf, async (req, res) => {
  try {
    const [result] = await pool.execute(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Benachrichtigung nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Als gelesen markiert.' });
  } catch (err) {
    console.error('Mark notification read error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', requireAuth, validateCsrf, async (req, res) => {
  try {
    await pool.execute('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.session.userId]);
    return res.json({ status: 'ok', message: 'Alle als gelesen markiert.' });
  } catch (err) {
    console.error('Mark all read error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// GET /api/notifications/settings
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT email_enabled, push_enabled, dashboard_enabled FROM notification_settings WHERE user_id = ?',
      [req.session.userId]
    );
    if (rows.length === 0) {
      return res.json({ status: 'ok', settings: { email_enabled: true, push_enabled: true, dashboard_enabled: true } });
    }
    return res.json({ status: 'ok', settings: rows[0] });
  } catch (err) {
    console.error('Get notification settings error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// PUT /api/notifications/settings
router.put('/settings', requireAuth, validateCsrf, async (req, res) => {
  const { email_enabled, push_enabled, dashboard_enabled } = req.body || {};
  try {
    const [existing] = await pool.execute('SELECT id FROM notification_settings WHERE user_id = ?', [req.session.userId]);
    if (existing.length > 0) {
      await pool.execute(
        'UPDATE notification_settings SET email_enabled = ?, push_enabled = ?, dashboard_enabled = ? WHERE user_id = ?',
        [email_enabled !== false, push_enabled !== false, dashboard_enabled !== false, req.session.userId]
      );
    } else {
      await pool.execute(
        'INSERT INTO notification_settings (user_id, email_enabled, push_enabled, dashboard_enabled) VALUES (?, ?, ?, ?)',
        [req.session.userId, email_enabled !== false, push_enabled !== false, dashboard_enabled !== false]
      );
    }
    return res.json({ status: 'ok', message: 'Einstellungen gespeichert.' });
  } catch (err) {
    console.error('Update notification settings error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

module.exports = router;
