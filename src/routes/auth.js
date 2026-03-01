'use strict';

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { pool } = require('../db');
const { ensureCsrfToken, validateCsrf } = require('../middleware/auth');
const { getMailTransporter } = require('../services/email');
const { rateLimit } = require('express-rate-limit');

const router = express.Router();

const BCRYPT_SALT_ROUNDS = 12;
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Zu viele Versuche. Bitte später erneut versuchen.' },
});

// Precomputed dummy hash (set from app.js/index.js)
let DUMMY_HASH;
function setDummyHash(hash) { DUMMY_HASH = hash; }
function getDummyHash() { return DUMMY_HASH; }

// --- CAPTCHA ---
router.get('/captcha', ensureCsrfToken, (req, res) => {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  req.session.captchaAnswer = a + b;
  res.json({ question: `${a} + ${b} = ?`, csrfToken: req.session.csrfToken });
});

// --- CSRF TOKEN ---
router.get('/csrf-token', ensureCsrfToken, (req, res) => {
  res.json({ csrfToken: req.session.csrfToken });
});

// --- REGISTER ---
router.post('/register', authLimiter, validateCsrf, async (req, res) => {
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
  // Password strength: uppercase, lowercase, number, special char
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return res.status(400).json({ status: 'error', message: 'Passwort muss Großbuchstaben, Kleinbuchstaben, Zahl und Sonderzeichen enthalten.' });
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
    const code = String(crypto.randomInt(100000, 1000000));
    const expiry = Date.now() + EMAIL_CODE_TTL_MS;

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
router.post('/verify-email', authLimiter, validateCsrf, async (req, res) => {
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
    const [rows] = await connection.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [pending.username, pending.email]
    );
    if (rows.length > 0) {
      delete req.session.pendingRegistration;
      return res.status(409).json({ status: 'error', message: 'Benutzername oder E-Mail bereits vergeben.' });
    }

    await connection.execute(
      'INSERT INTO users (username, email, password_hash, email_verified) VALUES (?, ?, ?, TRUE)',
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
router.post('/login', authLimiter, validateCsrf, async (req, res) => {
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
      await bcrypt.compare(password, DUMMY_HASH);
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
router.post('/logout', validateCsrf, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ status: 'error', message: 'Abmeldung fehlgeschlagen.' });
    }
    res.clearCookie('teammanager.sid');
    return res.json({ status: 'ok', message: 'Erfolgreich abgemeldet.' });
  });
});

// --- STATUS ---
router.get('/status', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({ loggedIn: true, username: req.session.username });
  }
  return res.json({ loggedIn: false, pendingVerification: !!(req.session && req.session.pendingRegistration) });
});

module.exports = router;
module.exports.setDummyHash = setDummyHash;
module.exports.getDummyHash = getDummyHash;
