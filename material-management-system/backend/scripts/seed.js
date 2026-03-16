require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { seedVipLevels } = require('../services/vipService');
const logger = require('../config/logger');

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/shiyuan';
  await mongoose.connect(uri);
  logger.info('Connected to MongoDB for seeding');

  await seedVipLevels();
  logger.info('VIP levels seeded');

  const existing = await User.findOne({ username: 'admin' });
  if (!existing) {
    const password_hash = await bcrypt.hash('admin123', 10);
    await User.create({
      username: 'admin',
      password_hash,
      roles: ['user', 'admin']
    });
    logger.info('Default admin user created (username: admin, password: admin123)');
  } else {
    logger.info('Admin user already exists, skipping');
  }

  await mongoose.disconnect();
  logger.info('Seeding complete');
  process.exit(0);
}

seed().catch((err) => {
  logger.error('Seed error', { message: err.message, stack: err.stack });
  process.exit(1);
});
