'use strict';

const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = mysql.createPool({
  host: 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PW,
  database: process.env.DB_NAME,
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
    console.error('DB connection error:', err.message);
    res.status(500).json({ status: 'error', message: 'Datenbankverbindung fehlgeschlagen.' });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
