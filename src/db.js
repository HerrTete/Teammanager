'use strict';

const mysql = require('mysql2/promise');

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
        email_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS clubs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        logo LONGBLOB,
        logo_mime VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        club_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS teams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sport_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS venues (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(500),
        coordinates VARCHAR(100),
        map_link VARCHAR(500),
        club_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS games (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        date DATE,
        time TIME,
        location_text VARCHAR(500),
        venue_id INT,
        opponent VARCHAR(255),
        team_id INT NOT NULL,
        created_by INT NOT NULL,
        result_markdown TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS trainings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        date DATE,
        time TIME,
        location_text VARCHAR(500),
        venue_id INT,
        team_id INT NOT NULL,
        created_by INT NOT NULL,
        result_markdown TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        team_id INT NOT NULL,
        jersey_number INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_team (user_id, team_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        role ENUM('PortalAdmin','VereinsAdmin','Trainer','Vereinsmitglied','Spieler') NOT NULL,
        club_id INT,
        sport_id INT,
        team_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
        FOREIGN KEY (sport_id) REFERENCES sports(id) ON DELETE CASCADE,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS invitations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        club_id INT NOT NULL,
        code VARCHAR(100) NOT NULL UNIQUE,
        invited_by INT NOT NULL,
        accepted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
        FOREIGN KEY (invited_by) REFERENCES users(id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type VARCHAR(50),
        title VARCHAR(255),
        message TEXT,
        reference_type VARCHAR(50),
        reference_id INT,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        subject VARCHAR(255),
        body TEXT,
        target_type ENUM('user','team','club','sport','game','training') NOT NULL,
        target_id INT NOT NULL,
        parent_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS message_recipients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        event_type ENUM('game','training') NOT NULL,
        event_id INT NOT NULL,
        status ENUM('pending','accepted','declined') DEFAULT 'pending',
        reminded BOOLEAN DEFAULT FALSE,
        escalated BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS photos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_type ENUM('game','training') NOT NULL,
        event_id INT NOT NULL,
        data LONGBLOB,
        mime_type VARCHAR(50),
        filename VARCHAR(255),
        uploaded_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS team_trainers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        team_id INT NOT NULL,
        user_id INT NOT NULL,
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        email_enabled BOOLEAN DEFAULT TRUE,
        push_enabled BOOLEAN DEFAULT TRUE,
        dashboard_enabled BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS club_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        club_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE
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

module.exports = { pool, initDb };
