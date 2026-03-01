module.exports = {
  testEnvironment: 'node',
  testTimeout: 10000,
  verbose: true,
  testPathIgnorePatterns: ['/node_modules/', '/tests/ui/'],
  moduleNameMapper: {
    '^marked$': '<rootDir>/tests/helpers/mockMarked.js',
    '^uuid$': '<rootDir>/tests/helpers/mockUuid.js',
  },
};
