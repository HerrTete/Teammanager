'use strict';

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { rateLimit } = require('express-rate-limit');
const helmet = require('helmet');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

const BCRYPT_SALT_ROUNDS = 12;
// Precomputed dummy hash for timing-safe user-enumeration prevention (avoid bcrypt.hash per request)
let DUMMY_HASH;

// Email verification code TTL in milliseconds (10 minutes)
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;

// Nodemailer transporter (SMTP credentials from environment variables).
// If SMTP_HOST is not set, a development-only test-account transport is used
// that logs the message to the console instead of actually sending it.
let mailTransporter;
async function getMailTransporter() {
  if (mailTransporter) return mailTransporter;
  if (process.env.SMTP_HOST) {
    mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Dev/test fallback: log to console
    mailTransporter = {
      sendMail: async (opts) => {
        console.log('[DEV] E-Mail would be sent:');
        console.log('  To:', opts.to);
        console.log('  Subject:', opts.subject);
        console.log('  Text:', opts.text);
        return { messageId: 'dev-only' };
      },
    };
  }
  return mailTransporter;
}
const SESSION_SECRET = process.env.SESSION_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET environment variable must be set in production');
  }
  return 'dev-only-insecure-secret-change-in-production';
})();
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

const dbPort = parseInt((process.env.DB_PORT || '').trim(), 10);
const dbConfig = {
  host: process.env.DB_HOST ? process.env.DB_HOST.trim() : 'localhost',
  port: isNaN(dbPort) ? 3306 : dbPort,
  user: process.env.DB_USER ? process.env.DB_USER.trim() : undefined,
  password: process.env.DB_PW ? process.env.DB_PW.trim() : undefined,
  database: process.env.DB_NAME ? process.env.DB_NAME.trim() : undefined,
};

const pool = mysql.createPool(dbConfig);

pool.on('error', (err) => {
  console.error('DB pool error:', err.code, err.message);
});

async function initDb() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database schema initialized.');
  } catch (err) {
    console.error('DB init error:', err.message);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

app.use(helmet());
const SESSION_COOKIE_NAME = 'teammanager.sid';

// Required for secure cookies to work correctly behind a TLS-terminating reverse proxy in production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// NOTE: MemoryStore is used by default and is not suitable for production.
// Configure a persistent store (e.g. connect-redis or express-mysql-session) for production deployments.
app.use(session({
  name: SESSION_COOKIE_NAME,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  // In production, tell express-session to read X-Forwarded-Proto directly so
  // it can correctly determine whether the connection is HTTPS when behind a
  // TLS-terminating reverse proxy (e.g. nginx) even if the proxy does not set
  // the header that Express itself reads for req.secure.
  proxy: process.env.NODE_ENV === 'production',
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    // 'auto' sets the Secure flag when the connection is HTTPS and omits it
    // when it is HTTP. This ensures the cookie is *always* sent to the browser
    // (critical for session continuity) while still marking it Secure whenever
    // the transport actually is encrypted.
    secure: 'auto',
    maxAge: SESSION_MAX_AGE_MS,
  },
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Zu viele Versuche. Bitte später erneut versuchen.' },
});

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/db-status', async (req, res) => {
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
    if (connection) {
      connection.release();
    }
  }
});

// --- CAPTCHA ---
app.get('/api/auth/captcha', ensureCsrfToken, (req, res) => {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  req.session.captchaAnswer = a + b;
  res.json({ question: `${a} + ${b} = ?`, csrfToken: req.session.csrfToken });
});

// --- CSRF TOKEN (for login form which doesn't go through captcha) ---
app.get('/api/auth/csrf-token', ensureCsrfToken, (req, res) => {
  res.json({ csrfToken: req.session.csrfToken });
});

// --- REGISTER ---
app.post('/api/auth/register', authLimiter, validateCsrf, async (req, res) => {
  const { username, email, password, captcha } = req.body || {};

  if (!username || !email || !password || captcha === undefined) {
    return res.status(400).json({ status: 'error', message: 'Alle Felder sind erforderlich.' });
  }

  if (req.session.captchaAnswer === undefined || parseInt(captcha, 10) !== req.session.captchaAnswer) {
    return res.status(400).json({ status: 'error', message: 'CAPTCHA falsch. Bitte erneut versuchen.' });
  }
  delete req.session.captchaAnswer;

  if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 50) {
    return res.status(400).json({ status: 'error', message: 'Benutzername muss 3–50 Zeichen lang sein.' });
  }
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ status: 'error', message: 'Ungültige E-Mail-Adresse.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ status: 'error', message: 'Passwort muss mindestens 8 Zeichen lang sein.' });
  }

  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [cleanUsername, cleanEmail]
    );
    if (rows.length > 0) {
      return res.status(409).json({ status: 'error', message: 'Benutzername oder E-Mail bereits vergeben.' });
    }
  } catch (err) {
    console.error('Register DB error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Datenbankfehler. Bitte versuchen Sie es später erneut.' });
  } finally {
    if (connection) connection.release();
  }

  try {
    const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    // Generate a 6-digit numeric verification code
    const code = String(crypto.randomInt(100000, 1000000));
    const expiry = Date.now() + EMAIL_CODE_TTL_MS;

    // Store pending registration in session
    req.session.pendingRegistration = { username: cleanUsername, email: cleanEmail, passwordHash: hash, code, expiry };

    const transporter = await getMailTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'Teammanager <no-reply@teammanager.local>',
      to: cleanEmail,
      subject: 'Teammanager – E-Mail-Verifizierung',
      text: `Hallo ${cleanUsername},\n\nIhr Verifizierungscode lautet: ${code}\n\nDer Code ist 10 Minuten gültig.\n\nFalls Sie sich nicht registriert haben, ignorieren Sie diese E-Mail.`,
    });
  } catch (err) {
    console.error('Register email error:', err.message);
    delete req.session.pendingRegistration;
    return res.status(500).json({ status: 'error', message: 'Verifizierungs-E-Mail konnte nicht gesendet werden. Bitte überprüfen Sie Ihre E-Mail-Adresse oder versuchen Sie es später erneut.' });
  }

  return res.status(200).json({ status: 'pending', message: 'Verifizierungscode wurde an Ihre E-Mail-Adresse gesendet.' });
});

// --- VERIFY EMAIL ---
app.post('/api/auth/verify-email', authLimiter, validateCsrf, async (req, res) => {
  const { code } = req.body || {};
  const pending = req.session.pendingRegistration;

  if (!pending) {
    return res.status(400).json({ status: 'error', message: 'Keine ausstehende Registrierung gefunden. Bitte erneut registrieren.' });
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Verifizierungscode fehlt.' });
  }

  if (Date.now() > pending.expiry) {
    delete req.session.pendingRegistration;
    return res.status(400).json({ status: 'error', errorCode: 'CODE_EXPIRED', message: 'Der Verifizierungscode ist abgelaufen. Bitte erneut registrieren.' });
  }

  // Timing-safe code comparison to prevent timing attacks
  const submittedCode = Buffer.from(code.trim().padEnd(6, '\0'));
  const expectedCode = Buffer.from(pending.code.padEnd(6, '\0'));
  const codeMatch = submittedCode.length === expectedCode.length &&
    crypto.timingSafeEqual(submittedCode, expectedCode);
  if (!codeMatch) {
    return res.status(400).json({ status: 'error', message: 'Ungültiger Verifizierungscode.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    // Check again that username/email are still available
    const [rows] = await connection.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [pending.username, pending.email]
    );
    if (rows.length > 0) {
      delete req.session.pendingRegistration;
      return res.status(409).json({ status: 'error', message: 'Benutzername oder E-Mail bereits vergeben.' });
    }

    await connection.execute(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [pending.username, pending.email, pending.passwordHash]
    );

    delete req.session.pendingRegistration;
    return res.status(201).json({ status: 'ok', message: 'E-Mail verifiziert. Registrierung erfolgreich.' });
  } catch (err) {
    console.error('Verify email error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Datenbankfehler. Bitte versuchen Sie es später erneut.' });
  } finally {
    if (connection) connection.release();
  }
});

// --- LOGIN ---
app.post('/api/auth/login', authLimiter, validateCsrf, async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ status: 'error', message: 'Benutzername und Passwort erforderlich.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT id, username, password_hash FROM users WHERE username = ?',
      [typeof username === 'string' ? username.trim() : '']
    );

    if (rows.length === 0) {
      await bcrypt.compare(password, DUMMY_HASH); // timing-safe: avoid user enumeration
      return res.status(401).json({ status: 'error', message: 'Ungültiger Benutzername oder Passwort.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ status: 'error', message: 'Ungültiger Benutzername oder Passwort.' });
    }

    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regenerate error:', err);
        return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
      }
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
        }
        return res.json({ status: 'ok', message: 'Anmeldung erfolgreich.', username: user.username, csrfToken: req.session.csrfToken });
      });
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  } finally {
    if (connection) connection.release();
  }
});

// --- LOGOUT ---
app.post('/api/auth/logout', validateCsrf, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ status: 'error', message: 'Abmeldung fehlgeschlagen.' });
    }
    res.clearCookie(SESSION_COOKIE_NAME);
    return res.json({ status: 'ok', message: 'Erfolgreich abgemeldet.' });
  });
});

// --- STATUS ---
app.get('/api/auth/status', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({ loggedIn: true, username: req.session.username });
  }
  return res.json({ loggedIn: false, pendingVerification: !!(req.session && req.session.pendingRegistration) });
});

Promise.all([
  initDb().catch(err => {
    console.error('DB initialization failed, server starting in degraded mode (database features unavailable):', err.message);
  }),
  bcrypt.hash('dummy-placeholder', BCRYPT_SALT_ROUNDS).then(h => { DUMMY_HASH = h; }),
]).then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
