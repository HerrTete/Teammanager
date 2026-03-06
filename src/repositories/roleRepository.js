'use strict';

const { pool } = require('../db');

const ROLE_HIERARCHY = ['PortalAdmin', 'VereinsAdmin', 'Trainer', 'Vereinsmitglied', 'Spieler'];

async function findUserRoles(userId) {
  const [rows] = await pool.execute(
    'SELECT role, club_id, sport_id, team_id FROM user_roles WHERE user_id = ?',
    [userId]
  );
  return rows;
}

async function isPortalAdmin(userId) {
  const [rows] = await pool.execute(
    "SELECT id FROM user_roles WHERE user_id = ? AND role = 'PortalAdmin'",
    [userId]
  );
  return rows.length > 0;
}

async function findRolesForClub(userId, clubId) {
  const roles = await findUserRoles(userId);
  return roles.filter((r) => {
    if (r.role === 'PortalAdmin') return true;
    return r.club_id === parseInt(clubId, 10);
  });
}

async function getHighestRoleForClub(userId, clubId) {
  const roles = await findRolesForClub(userId, clubId);
  if (roles.length === 0) return null;
  for (const level of ROLE_HIERARCHY) {
    if (roles.some((r) => r.role === level)) return level;
  }
  return null;
}

async function isClubMember(userId, clubId) {
  const [rows] = await pool.execute(
    'SELECT id FROM club_members WHERE user_id = ? AND club_id = ?',
    [userId, clubId]
  );
  return rows.length > 0;
}

module.exports = {
  findUserRoles,
  isPortalAdmin,
  findRolesForClub,
  getHighestRoleForClub,
  isClubMember,
};
