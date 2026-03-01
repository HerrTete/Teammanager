'use strict';

const mockConnection = {
  execute: jest.fn().mockResolvedValue([{ insertId: 1 }, []]),
  release: jest.fn(),
};

const mockPool = {
  execute: jest.fn().mockResolvedValue([[], []]),
  getConnection: jest.fn().mockResolvedValue(mockConnection),
  on: jest.fn(),
};

jest.mock('../../src/db', () => ({
  pool: mockPool,
  initDb: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('Seed Module', () => {
  let seed;
  let db;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection.execute.mockResolvedValue([{ insertId: 1 }, []]);
    mockPool.getConnection.mockResolvedValue(mockConnection);
    seed = require('../../src/seed');
    db = require('../../src/db');
  });

  test('exports seedDb function', () => {
    expect(seed.seedDb).toBeDefined();
    expect(typeof seed.seedDb).toBe('function');
  });

  test('seedDb drops all tables and calls initDb', async () => {
    await seed.seedDb();

    expect(mockPool.getConnection).toHaveBeenCalled();
    expect(db.initDb).toHaveBeenCalled();

    const executeCalls = mockConnection.execute.mock.calls.map(c => c[0].trim());

    // Verify FOREIGN_KEY_CHECKS are toggled
    expect(executeCalls).toContain('SET FOREIGN_KEY_CHECKS = 0');
    expect(executeCalls).toContain('SET FOREIGN_KEY_CHECKS = 1');

    // Verify tables are dropped
    const dropCalls = executeCalls.filter(s => s.startsWith('DROP TABLE IF EXISTS'));
    expect(dropCalls.length).toBe(18);
  });

  test('seedDb inserts users for all roles', async () => {
    await seed.seedDb();

    const insertUserCalls = mockConnection.execute.mock.calls.filter(
      c => typeof c[0] === 'string' && c[0].includes('INSERT INTO users')
    );
    // 6 users: portaladmin, vereinsadmin, trainer, spieler, mitglied, kind
    expect(insertUserCalls.length).toBe(6);

    const usernames = insertUserCalls.map(c => c[1][0]);
    expect(usernames).toContain('portaladmin');
    expect(usernames).toContain('vereinsadmin');
    expect(usernames).toContain('trainer');
    expect(usernames).toContain('spieler');
    expect(usernames).toContain('mitglied');
    expect(usernames).toContain('kind');
  });

  test('seedDb inserts club, sport, and team', async () => {
    await seed.seedDb();

    const calls = mockConnection.execute.mock.calls;
    const clubInsert = calls.find(c => typeof c[0] === 'string' && c[0].includes('INSERT INTO clubs'));
    const sportInsert = calls.find(c => typeof c[0] === 'string' && c[0].includes('INSERT INTO sports'));
    const teamInsert = calls.find(c => typeof c[0] === 'string' && c[0].includes('INSERT INTO teams'));

    expect(clubInsert).toBeDefined();
    expect(clubInsert[1]).toContain('Dorfverein');

    expect(sportInsert).toBeDefined();
    expect(sportInsert[1]).toContain('Basketball');

    expect(teamInsert).toBeDefined();
    expect(teamInsert[1]).toContain('BBL U14 mix');
  });

  test('seedDb inserts roles for all users', async () => {
    await seed.seedDb();

    const roleCalls = mockConnection.execute.mock.calls.filter(
      c => typeof c[0] === 'string' && c[0].includes('INSERT INTO user_roles')
    );
    // 6 roles: PortalAdmin, VereinsAdmin, Trainer, Spieler, Vereinsmitglied, Spieler(kind)
    expect(roleCalls.length).toBe(6);

    const roles = roleCalls.map(c => c[1][1]);
    expect(roles).toContain('PortalAdmin');
    expect(roles).toContain('VereinsAdmin');
    expect(roles).toContain('Trainer');
    expect(roles).toContain('Spieler');
    expect(roles).toContain('Vereinsmitglied');
  });

  test('seedDb inserts trainer into team_trainers', async () => {
    await seed.seedDb();

    const trainerCall = mockConnection.execute.mock.calls.find(
      c => typeof c[0] === 'string' && c[0].includes('INSERT INTO team_trainers')
    );
    expect(trainerCall).toBeDefined();
  });

  test('seedDb inserts spieler and kind into players', async () => {
    await seed.seedDb();

    const playerCalls = mockConnection.execute.mock.calls.filter(
      c => typeof c[0] === 'string' && c[0].includes('INSERT INTO players')
    );
    // spieler and kind
    expect(playerCalls.length).toBe(2);
  });

  test('seedDb releases connection on error', async () => {
    const errorRelease = jest.fn();
    mockPool.getConnection.mockResolvedValueOnce({
      ...mockConnection,
      execute: jest.fn().mockRejectedValue(new Error('DB error')),
      release: errorRelease,
    });

    await expect(seed.seedDb()).rejects.toThrow('DB error');
    expect(errorRelease).toHaveBeenCalled();
  });
});
