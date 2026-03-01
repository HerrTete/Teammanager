'use strict';

const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const { pool } = require('./db');

// Route modules
const authRoutes = require('./routes/auth');
const clubRoutes = require('./routes/clubs');
const sportRoutes = require('./routes/sports');
const teamRoutes = require('./routes/teams');
const gameRoutes = require('./routes/games');
const trainingRoutes = require('./routes/trainings');
const playerRoutes = require('./routes/players');
const venueRoutes = require('./routes/venues');
const attendanceRoutes = require('./routes/attendance');
const notificationRoutes = require('./routes/notifications');
const messageRoutes = require('./routes/messages');
const exportRoutes = require('./routes/exports');
const invitationRoutes = require('./routes/invitations');
const photoRoutes = require('./routes/photos');
const dashboardRoutes = require('./routes/dashboard');

const { requireAuth, requireRole } = require('./middleware/auth');

const app = express();

const SESSION_SECRET = process.env.SESSION_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET environment variable must be set in production');
  }
  return 'dev-only-insecure-secret-change-in-production';
})();
const SESSION_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_COOKIE_NAME = 'teammanager.sid';

app.use(helmet());

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(session({
  name: SESSION_COOKIE_NAME,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: process.env.NODE_ENV === 'production',
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: 'auto',
    maxAge: SESSION_MAX_AGE_MS,
  },
}));

// --- Health / DB status ---
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/db-status', async (_req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.ping();
    res.json({ status: 'ok', message: 'Datenbankverbindung erfolgreich.' });
  } catch (err) {
    console.error('DB connection error:', err.code, err.message);
    res.status(500).json({
      status: 'error',
      message: 'Datenbankverbindung fehlgeschlagen.',
      detail: `${err.code ? err.code + ': ' : ''}${err.message}`,
    });
  } finally {
    if (connection) connection.release();
  }
});

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/clubs/:clubId/sports', sportRoutes);
app.use('/api/clubs/:clubId/sports/:sportId/teams', teamRoutes);
app.use('/api/clubs/:clubId/teams/:teamId/games', gameRoutes);
app.use('/api/clubs/:clubId/teams/:teamId/trainings', trainingRoutes);
app.use('/api/clubs/:clubId/teams/:teamId/players', playerRoutes);
app.use('/api/clubs/:clubId/venues', venueRoutes);
app.use('/api/clubs/:clubId/events/:eventType/:eventId/attendance', attendanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/clubs/:clubId/messages', messageRoutes);
app.use('/api/clubs/:clubId', exportRoutes);
app.use('/api/clubs/:clubId/invitations', invitationRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/clubs/:clubId/events/:eventType/:eventId/photos', photoRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Photo direct access routes (outside club context)

// GET /api/photos/:photoId
// Disabled to enforce access via club-scoped photo routes and prevent cross-tenant exposure.
app.get('/api/photos/:photoId', requireAuth, async (req, res) => {
  return res.status(404).json({
    status: 'error',
    message: 'Direkter Fotozugriff per ID ist nicht verfügbar. Bitte nutzen Sie die Vereins-spezifischen Endpunkte.'
  });
});

// DELETE /api/photos/:photoId
// Disabled to enforce deletion via club-scoped photo routes and prevent cross-tenant exposure.
app.delete('/api/photos/:photoId', requireAuth, requireRole(['PortalAdmin', 'VereinsAdmin', 'Trainer']), async (req, res) => {
  return res.status(404).json({
    status: 'error',
    message: 'Direktes Löschen von Fotos per ID ist nicht verfügbar. Bitte nutzen Sie die Vereins-spezifischen Endpunkte.'
  });
});

module.exports = app;
