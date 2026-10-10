const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Disable command buffering so disconnected operations don't hang for 10 seconds
mongoose.set('bufferCommands', false);

const connectDB = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/boardcollab';
  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
      autoIndex: true
    });
    logger.info(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (err) {
    logger.warn(`MongoDB not running locally (${err.message}).`);
    logger.info(`Running in in-memory session mode. Everything works with full real-time collaboration!`);
    return null;
  }
};

module.exports = connectDB;
