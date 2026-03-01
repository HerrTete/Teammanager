'use strict';

const crypto = require('crypto');
const { pool } = require('../db');

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ status: 'error', message: 'Nicht angemeldet.' });
  }
  next();
}

function requireRole(roles) {
  return async (req, res, next) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ status: 'error', message: 'Nicht angemeldet.' });
    }
    try {
      const [rows] = await pool.execute(
        'SELECT role, club_id, sport_id, team_id FROM user_roles WHERE user_id = ?',
        [req.session.userId]
      );
      const clubId = req.params.clubId ? parseInt(req.params.clubId, 10) : null;
      const hasRole = rows.some((r) => {
        if (!roles.includes(r.role)) return false;
        // PortalAdmin is system-wide, no club scoping needed
        if (r.role === 'PortalAdmin') return true;
        // For other roles, scope to the current club context if available
        if (clubId && r.club_id && r.club_id !== clubId) return false;
        return true;
      });
      if (!hasRole) {
        return res.status(403).json({ status: 'error', message: 'Keine Berechtigung.' });
      }
      req.userRoles = rows;
      next();
    } catch (err) {
      console.error('requireRole error:', err.message);
      return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
    }
  };
}

async function requireClubAccess(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ status: 'error', message: 'Nicht angemeldet.' });
  }
  const clubId = req.params.clubId;
  if (!clubId) {
    return res.status(400).json({ status: 'error', message: 'Club-ID fehlt.' });
  }
  try {
    // PortalAdmin has access to all clubs
    const [adminRoles] = await pool.execute(
      "SELECT id FROM user_roles WHERE user_id = ? AND role = 'PortalAdmin'",
      [req.session.userId]
    );
    if (adminRoles.length > 0) return next();

    const [rows] = await pool.execute(
      'SELECT id FROM club_members WHERE user_id = ? AND club_id = ?',
      [req.session.userId, clubId]
    );
    if (rows.length === 0) {
      return res.status(403).json({ status: 'error', message: 'Kein Zugriff auf diesen Verein.' });
    }
    next();
  } catch (err) {
    console.error('requireClubAccess error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
}

function ensureCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  next();
}

function validateCsrf(req, res, next) {
  const token = req.headers['x-csrf-token'];
  if (!token || !req.session.csrfToken || token !== req.session.csrfToken) {
    return res.status(403).json({ status: 'error', message: 'CSRF-Token ungültig.' });
  }
  next();
}

module.exports = { requireAuth, requireRole, requireClubAccess, ensureCsrfToken, validateCsrf };

// Helper: verify a team belongs to a club via teams -> sports -> clubs hierarchy
async function verifyTeamBelongsToClub(pool, teamId, clubId) {
  const [rows] = await pool.execute(
    'SELECT t.id FROM teams t INNER JOIN sports s ON t.sport_id = s.id WHERE t.id = ? AND s.club_id = ?',
    [teamId, clubId]
  );
  return rows.length > 0;
}

// Helper: verify an event (game/training) belongs to a club
async function verifyEventBelongsToClub(pool, eventType, eventId, clubId) {
  const table = eventType === 'game' ? 'games' : 'trainings';
  const [rows] = await pool.execute(
    `SELECT e.id FROM ${table} e INNER JOIN teams t ON e.team_id = t.id INNER JOIN sports s ON t.sport_id = s.id WHERE e.id = ? AND s.club_id = ?`,
    [eventId, clubId]
  );
  return rows.length > 0;
}

module.exports.verifyTeamBelongsToClub = verifyTeamBelongsToClub;
module.exports.verifyEventBelongsToClub = verifyEventBelongsToClub;
