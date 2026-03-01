module.exports = {
  testEnvironment: 'node',
  testTimeout: 10000,
  verbose: true,
  moduleNameMapper: {
    '^marked$': '<rootDir>/tests/helpers/mockMarked.js',
    '^uuid$': '<rootDir>/tests/helpers/mockUuid.js',
  },
};
