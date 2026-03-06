const express = require('express');
const path = require('path');
const session = require('express-session');

function createMockServer(options) {
  const opts = Object.assign({ isPortalAdmin: false, clubRole: null }, options || {});
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', '..', '..', 'public')));
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', secure: false },
  }));

  // Mock CSRF token
  app.get('/api/auth/csrf-token', (req, res) => {
    req.session.csrfToken = 'test-csrf-token';
    res.json({ csrfToken: 'test-csrf-token' });
  });

  // Mock captcha
  app.get('/api/auth/captcha', (req, res) => {
    req.session.captchaAnswer = 5;
    req.session.csrfToken = req.session.csrfToken || 'test-csrf-token';
    res.json({ question: '2 + 3 = ?', csrfToken: req.session.csrfToken });
  });

  // Mock auth status
  app.get('/api/auth/status', (req, res) => {
    if (req.session && req.session.userId) {
      return res.json({ loggedIn: true, username: req.session.username || 'testuser' });
    }
    res.json({ loggedIn: false, pendingVerification: false });
  });

  // Mock login
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'testuser' && password === 'Test1234!') {
      req.session.userId = 1;
      req.session.username = username;
      req.session.csrfToken = 'new-csrf-token';
      return res.json({ status: 'ok', message: 'Anmeldung erfolgreich.', username, csrfToken: 'new-csrf-token' });
    }
    return res.status(401).json({ status: 'error', message: 'Ungültiger Benutzername oder Passwort.' });
  });

  // Mock register
  app.post('/api/auth/register', (req, res) => {
    const { username, email, password, captcha } = req.body;
    if (!username || !email || !password || captcha === undefined) {
      return res.status(400).json({ status: 'error', message: 'Alle Felder sind erforderlich.' });
    }
    if (parseInt(captcha, 10) !== 5) {
      return res.status(400).json({ status: 'error', message: 'CAPTCHA falsch.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ status: 'error', message: 'Passwort muss mindestens 8 Zeichen lang sein.' });
    }
    req.session.pendingRegistration = { username, email };
    return res.json({ status: 'pending', message: 'Verifizierungscode wurde an Ihre E-Mail-Adresse gesendet.' });
  });

  // Mock verify email
  app.post('/api/auth/verify-email', (req, res) => {
    const { code } = req.body;
    if (code === '123456') {
      delete req.session.pendingRegistration;
      return res.status(201).json({ status: 'ok', message: 'E-Mail verifiziert. Registrierung erfolgreich.' });
    }
    return res.status(400).json({ status: 'error', message: 'Ungültiger Verifizierungscode.' });
  });

  // Mock logout
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.json({ status: 'ok', message: 'Erfolgreich abgemeldet.' });
    });
  });

  // Mock DB status
  app.get('/api/db-status', (req, res) => {
    res.json({ status: 'ok', message: 'Datenbankverbindung erfolgreich.' });
  });

  // Mock health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Mock clubs
  app.get('/api/clubs', (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ status: 'error', message: 'Nicht angemeldet.' });
    }
    const clubBase = [
      { id: 1, name: 'FC Test', created_at: '2024-01-01' },
      { id: 2, name: 'SV Muster', created_at: '2024-02-01' },
    ];
    const clubs = clubBase.map(c => Object.assign({}, c, { role: opts.clubRole || null }));
    res.json({ status: 'ok', isPortalAdmin: opts.isPortalAdmin, clubs });
  });

  // Mock single club
  app.get('/api/clubs/:clubId', (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ status: 'error', message: 'Nicht angemeldet.' });
    }
    const clubId = parseInt(req.params.clubId, 10);
    const names = { 1: 'FC Test', 2: 'SV Muster' };
    res.json({
      status: 'ok',
      club: { id: clubId, name: names[clubId] || 'Unknown', role: opts.clubRole || 'Vereinsmitglied' },
    });
  });

  // Mock dashboard
  app.get('/api/dashboard', (req, res) => {
    res.json({
      status: 'ok',
      clubs: [
        {
          clubId: 1,
          clubName: 'FC Test',
          upcomingEvents: [
            { type: 'game', id: 1, title: 'Testspiel', date: '2024-06-15', time: '15:00', opponent: 'FC Gegner', teamName: 'A-Mannschaft' },
            { type: 'training', id: 1, title: 'Dienstags-Training', date: '2024-06-14', time: '18:00', teamName: 'A-Mannschaft' },
          ],
          recentNotifications: [
            { id: 1, title: 'Neues Spiel', message: 'Testspiel am 15.06.', is_read: false },
          ],
        },
      ],
    });
  });

  // Mock notifications
  app.get('/api/notifications', (req, res) => {
    res.json({
      status: 'ok',
      notifications: [
        { id: 1, type: 'game', title: 'Neues Spiel', message: 'Testspiel am 15.06.', is_read: false, created_at: '2024-06-10' },
        { id: 2, type: 'team', title: 'Mannschaftszuordnung', message: 'Sie wurden A-Mannschaft zugeordnet.', is_read: true, created_at: '2024-06-09' },
      ],
    });
  });

  app.put('/api/notifications/read-all', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.put('/api/notifications/:id/read', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/notifications/settings', (req, res) => {
    res.json({ status: 'ok', settings: { email_enabled: true, push_enabled: true, dashboard_enabled: true } });
  });

  app.put('/api/notifications/settings', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Mock messages
  app.get('/api/clubs/:clubId/messages', (req, res) => {
    res.json({
      status: 'ok',
      messages: [
        { id: 1, subject: 'Training morgen', body: 'Bitte pünktlich erscheinen!', sender_name: 'Trainer Max', created_at: '2024-06-10', target_type: 'team' },
      ],
    });
  });

  app.post('/api/clubs/:clubId/messages', (req, res) => {
    res.status(201).json({ status: 'ok', messageId: 2 });
  });

  // Mock sports (with inline teams for Teamverwaltung/Activities)
  app.get('/api/clubs/:clubId/sports', (req, res) => {
    res.json({ status: 'ok', sports: [
      { id: 1, name: 'Fußball', teams: [{ id: 1, name: 'A-Mannschaft' }, { id: 2, name: 'B-Mannschaft' }] },
      { id: 2, name: 'Handball', teams: [{ id: 3, name: 'Erste' }] },
    ] });
  });

  // Mock teams
  app.get('/api/clubs/:clubId/sports/:sportId/teams', (req, res) => {
    res.json({ status: 'ok', teams: [
      { id: 1, name: 'A-Mannschaft' },
      { id: 2, name: 'B-Mannschaft' },
    ] });
  });

  // Mock venues
  app.get('/api/clubs/:clubId/venues', (req, res) => {
    res.json({ status: 'ok', venues: [
      { id: 1, name: 'Hauptstadion', street: 'Sportstr.', house_number: '1', zip_code: '12345', city: 'Teststadt', address: 'Sportstr. 1', coordinates: '51.0,10.0', map_link: 'https://maps.example.com' },
    ] });
  });

  // Mock games
  app.get('/api/clubs/:clubId/teams/:teamId/games', (req, res) => {
    res.json({ status: 'ok', games: [
      { id: 1, date: '2024-06-15T15:00:00', opponent: 'FC Gegner', title: 'Testspiel' },
      { id: 2, date: '2024-06-22T14:00:00', opponent: 'SV Rival', title: 'Ligaspiel' },
    ] });
  });

  // Mock trainings
  app.get('/api/clubs/:clubId/teams/:teamId/trainings', (req, res) => {
    res.json({ status: 'ok', trainings: [
      { id: 1, date: '2024-06-14T18:00:00', title: 'Dienstags-Training' },
      { id: 2, date: '2024-06-16T10:00:00', title: 'Wochenend-Training' },
    ] });
  });

  // Mock invitations
  app.post('/api/clubs/:clubId/invitations', (req, res) => {
    res.status(201).json({ status: 'ok', code: 'ABC123' });
  });

  return app;
}

module.exports = { createMockServer };
