'use strict';

const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

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
