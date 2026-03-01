'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const { requireAuth, requireRole, requireClubAccess, validateCsrf } = require('../middleware/auth');
const { sendInvitation } = require('../services/email');

const router = express.Router({ mergeParams: true });

// POST /api/clubs/:clubId/invitations
router.post('/', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin']), async (req, res) => {
  const { email, role } = req.body || {};
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ status: 'error', message: 'Gültige E-Mail-Adresse ist erforderlich.' });
  }
  const validRoles = ['VereinsAdmin', 'Trainer', 'Vereinsmitglied', 'Spieler'];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ status: 'error', message: 'Gültige Rolle ist erforderlich.' });
  }
  try {
    const code = uuidv4();
    await pool.execute(
      'INSERT INTO invitations (email, role, club_id, code, invited_by) VALUES (?, ?, ?, ?, ?)',
      [email.trim().toLowerCase(), role, req.params.clubId, code, req.session.userId]
    );
    // Get club name for email
    const [clubs] = await pool.execute('SELECT name FROM clubs WHERE id = ?', [req.params.clubId]);
    const clubName = clubs.length > 0 ? clubs[0].name : 'Verein';
    await sendInvitation(email.trim().toLowerCase(), clubName, role, code);
    return res.status(201).json({ status: 'ok', code, message: 'Einladung gesendet.' });
  } catch (err) {
    console.error('Create invitation error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// GET /api/invitations/code/:code
router.get('/code/:code', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT i.id, i.email, i.role, i.club_id, i.accepted, i.created_at, c.name AS club_name FROM invitations i INNER JOIN clubs c ON i.club_id = c.id WHERE i.code = ?',
      [req.params.code]
    );
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Einladung nicht gefunden.' });
    }
    return res.json({ status: 'ok', invitation: rows[0] });
  } catch (err) {
    console.error('Get invitation error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/invitations/code/:code/accept
router.post('/code/:code/accept', requireAuth, validateCsrf, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM invitations WHERE code = ?', [req.params.code]);
    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Einladung nicht gefunden.' });
    }
    const invitation = rows[0];
    if (invitation.accepted) {
      return res.status(400).json({ status: 'error', message: 'Einladung bereits angenommen.' });
    }

    // Mark as accepted
    await pool.execute('UPDATE invitations SET accepted = TRUE WHERE id = ?', [invitation.id]);

    // Add user to club members
    const [existingMember] = await pool.execute(
      'SELECT id FROM club_members WHERE user_id = ? AND club_id = ?',
      [req.session.userId, invitation.club_id]
    );
    if (existingMember.length === 0) {
      await pool.execute('INSERT INTO club_members (user_id, club_id) VALUES (?, ?)', [req.session.userId, invitation.club_id]);
    }

    // Assign role
    await pool.execute(
      'INSERT INTO user_roles (user_id, role, club_id) VALUES (?, ?, ?)',
      [req.session.userId, invitation.role, invitation.club_id]
    );

    return res.json({ status: 'ok', message: 'Einladung angenommen.' });
  } catch (err) {
    console.error('Accept invitation error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

module.exports = router;
