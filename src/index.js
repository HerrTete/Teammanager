'use strict';

const bcrypt = require('bcrypt');
const app = require('./app');
const { seedDb } = require('./seed');
const { setDummyHash } = require('./routes/auth');

const PORT = process.env.PORT || 3000;
const BCRYPT_SALT_ROUNDS = 12;

Promise.all([
  seedDb().catch(err => {
    console.error('DB seed failed, server starting in degraded mode (database features unavailable):', err.message);
  }),
  bcrypt.hash('dummy-placeholder', BCRYPT_SALT_ROUNDS).then(h => { setDummyHash(h); }),
]).then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
