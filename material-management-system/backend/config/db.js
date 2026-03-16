const mongoose = require('mongoose');
const logger = require('./logger');

async function connectDB(uri) {
  try {
    await mongoose.connect(uri);
    logger.info('MongoDB connected', { uri: uri.replace(/\/\/.*@/, '//***@') });
  } catch (error) {
    logger.error('MongoDB connection error', { message: error.message });
    process.exit(1);
  }
}

module.exports = connectDB;
