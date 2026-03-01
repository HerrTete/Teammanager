'use strict';

const bcrypt = require('bcrypt');
const { pool, initDb } = require('./db');

const SEED_PASSWORD = 'geheimgeheim123';
const BCRYPT_SALT_ROUNDS = 12;

const TABLES_DROP_ORDER = [
  'notification_settings',
  'club_members',
  'photos',
  'attendance',
  'message_recipients',
  'messages',
  'notifications',
  'invitations',
  'team_trainers',
  'players',
  'trainings',
  'games',
  'venues',
  'user_roles',
  'teams',
  'sports',
  'clubs',
  'users',
];

async function seedDb() {
  let connection;
  try {
    connection = await pool.getConnection();

    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of TABLES_DROP_ORDER) {
      await connection.execute(`DROP TABLE IF EXISTS \`${table}\``);
    }
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    connection.release();
    connection = null;

    await initDb();

    connection = await pool.getConnection();

    const hash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_SALT_ROUNDS);

    // --- Users ---
    const users = [
      { username: 'portaladmin', email: 'portaladmin@herrtete.de' },
      { username: 'vereinsadmin', email: 'vereinsadmin@herrtete.de' },
      { username: 'trainer', email: 'trainer@herrtete.de' },
      { username: 'spieler', email: 'spieler@herrtete.de' },
      { username: 'mitglied', email: 'mitglied@herrtete.de' },
      { username: 'kind', email: 'kind@herrtete.de' },
    ];
    const userIds = {};
    for (const u of users) {
      const [result] = await connection.execute(
        'INSERT INTO users (username, email, password_hash, email_verified) VALUES (?, ?, ?, TRUE)',
        [u.username, u.email, hash]
      );
      userIds[u.username] = result.insertId;
    }

    // --- Club ---
    const [clubResult] = await connection.execute(
      'INSERT INTO clubs (name) VALUES (?)',
      ['Dorfverein']
    );
    const clubId = clubResult.insertId;

    // --- Sport ---
    const [sportResult] = await connection.execute(
      'INSERT INTO sports (name, club_id) VALUES (?, ?)',
      ['Basketball', clubId]
    );
    const sportId = sportResult.insertId;

    // --- Team ---
    const [teamResult] = await connection.execute(
      'INSERT INTO teams (name, sport_id) VALUES (?, ?)',
      ['BBL U14 mix', sportId]
    );
    const teamId = teamResult.insertId;

    // --- Roles ---
    await connection.execute(
      'INSERT INTO user_roles (user_id, role) VALUES (?, ?)',
      [userIds['portaladmin'], 'PortalAdmin']
    );
    await connection.execute(
      'INSERT INTO user_roles (user_id, role, club_id) VALUES (?, ?, ?)',
      [userIds['vereinsadmin'], 'VereinsAdmin', clubId]
    );
    await connection.execute(
      'INSERT INTO user_roles (user_id, role, club_id, sport_id, team_id) VALUES (?, ?, ?, ?, ?)',
      [userIds['trainer'], 'Trainer', clubId, sportId, teamId]
    );
    await connection.execute(
      'INSERT INTO user_roles (user_id, role, club_id, sport_id, team_id) VALUES (?, ?, ?, ?, ?)',
      [userIds['spieler'], 'Spieler', clubId, sportId, teamId]
    );
    await connection.execute(
      'INSERT INTO user_roles (user_id, role, club_id, sport_id, team_id) VALUES (?, ?, ?, ?, ?)',
      [userIds['mitglied'], 'Vereinsmitglied', clubId, sportId, teamId]
    );
    await connection.execute(
      'INSERT INTO user_roles (user_id, role, club_id, sport_id, team_id) VALUES (?, ?, ?, ?, ?)',
      [userIds['kind'], 'Spieler', clubId, sportId, teamId]
    );

    // --- Club members ---
    for (const username of Object.keys(userIds)) {
      await connection.execute(
        'INSERT INTO club_members (user_id, club_id) VALUES (?, ?)',
        [userIds[username], clubId]
      );
    }

    // --- Team trainer ---
    await connection.execute(
      'INSERT INTO team_trainers (team_id, user_id) VALUES (?, ?)',
      [teamId, userIds['trainer']]
    );

    // --- Players ---
    for (const username of ['spieler', 'kind']) {
      await connection.execute(
        'INSERT INTO players (user_id, team_id) VALUES (?, ?)',
        [userIds[username], teamId]
      );
    }

    console.log('Database seeded successfully.');
  } catch (err) {
    console.error('DB seed error:', err.message);
    throw err;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { seedDb };
