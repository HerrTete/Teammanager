'use strict';

const mockPool = {
  execute: jest.fn().mockResolvedValue([[], []]),
  getConnection: jest.fn().mockResolvedValue({
    execute: jest.fn().mockResolvedValue([[], []]),
    release: jest.fn(),
    ping: jest.fn().mockResolvedValue(true),
  }),
  on: jest.fn(),
};

jest.mock('../../src/db', () => ({
  pool: mockPool,
  initDb: jest.fn().mockResolvedValue(undefined),
}));

module.exports = { mockPool };
