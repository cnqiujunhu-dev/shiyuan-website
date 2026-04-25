require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const logger = require('../config/logger');

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shiyuan';
  await mongoose.connect(uri);

  const users = await User.find({
    $or: [
      { uid: { $exists: false } },
      { uid: null },
      { uid: '' }
    ]
  });

  let updated = 0;
  for (const user of users) {
    user.uid = undefined;
    await user.save();
    updated += 1;
  }

  logger.info('User UID backfill complete', { updated });
  console.log(`User UID backfill complete: ${updated} updated`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  logger.error('User UID backfill failed', { message: err.message, stack: err.stack });
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect failures during shutdown.
  }
  process.exit(1);
});
