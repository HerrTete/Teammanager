'use strict';

const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PW,
  database: process.env.DB_NAME,
};

// DEBUG: Extended logging to trace "The string did not match the expected pattern." error
// TODO: Remove or reduce this logging after the root cause is identified
console.log('DB environment variables (raw):');
console.log('  DB_HOST      :', JSON.stringify(process.env.DB_HOST), '| type:', typeof process.env.DB_HOST, '| length:', process.env.DB_HOST ? process.env.DB_HOST.length : 0);
console.log('  DB_PORT      :', JSON.stringify(process.env.DB_PORT), '| type:', typeof process.env.DB_PORT, '| length:', process.env.DB_PORT ? process.env.DB_PORT.length : 0);
console.log('  DB_USER      :', JSON.stringify(process.env.DB_USER), '| type:', typeof process.env.DB_USER, '| length:', process.env.DB_USER ? process.env.DB_USER.length : 0);
console.log('  DB_NAME      :', JSON.stringify(process.env.DB_NAME), '| type:', typeof process.env.DB_NAME, '| length:', process.env.DB_NAME ? process.env.DB_NAME.length : 0);
console.log('  DB_PW        :', JSON.stringify(process.env.DB_PW),   '| type:', typeof process.env.DB_PW,   '| length:', process.env.DB_PW ? process.env.DB_PW.length : 0);
if (process.env.DB_PW) {
  const charCodes = Array.from(process.env.DB_PW).map((c) => `${c}(${c.charCodeAt(0)})`).join(' ');
  console.log('  DB_PW chars  :', charCodes);
}
console.log('DB config (parsed):', {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database,
  password: dbConfig.password,
});

const pool = mysql.createPool(dbConfig);

pool.on('error', (err) => {
  console.error('DB pool error:', err.code, err.message);
});

app.use(express.static(path.join(__dirname, '..', 'public')));

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
    console.error('DB connection error (full):', err);
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
