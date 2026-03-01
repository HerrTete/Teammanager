'use strict';

const mockConnection = {
  execute: jest.fn().mockResolvedValue([[], []]),
  release: jest.fn(),
  ping: jest.fn().mockResolvedValue(true),
};

const mockPool = {
  execute: jest.fn().mockResolvedValue([[], []]),
  getConnection: jest.fn().mockResolvedValue(mockConnection),
  on: jest.fn(),
};

jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(() => mockPool),
}));

describe('Database Module', () => {
  let db;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection.execute.mockResolvedValue([[], []]);
    mockPool.getConnection.mockResolvedValue(mockConnection);
    db = require('../../src/db');
  });

  test('exports pool and initDb', () => {
    expect(db.pool).toBeDefined();
    expect(db.initDb).toBeDefined();
    expect(typeof db.initDb).toBe('function');
  });

  test('pool has execute method', () => {
    expect(typeof db.pool.execute).toBe('function');
  });

  test('initDb creates tables', async () => {
    await db.initDb();
    expect(mockPool.getConnection).toHaveBeenCalled();
    expect(mockConnection.execute).toHaveBeenCalled();
    // Should call execute for each CREATE TABLE (15+ tables)
    expect(mockConnection.execute.mock.calls.length).toBeGreaterThanOrEqual(15);
    expect(mockConnection.release).toHaveBeenCalled();
  });
});
