const mongoose = require('mongoose');

/**
 * Connect to MongoDB using Mongoose.
 * This function is invoked at server startup. If the connection fails,
 * the promise will reject and the server will exit.
 */
async function connectDB(uri) {
  try {
    // See https://mongoosejs.com/docs/connections.html for options
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
}

module.exports = connectDB;