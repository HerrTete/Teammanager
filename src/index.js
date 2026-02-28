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

console.log('DB config:', {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database,
  password: dbConfig.password ? '***' : '(not set)',
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
