const mongoose = require('mongoose');
require('dotenv').config();

let cachedConnection = null;
let connectionPromise = null;

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  try {
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 1,
      minPoolSize: 1,
      maxIdleTimeMS: 10000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 5000,
      compressors: ['zlib'],
      w: 'majority',
      wtimeoutMS: 5000,
      bufferCommands: false,
      autoIndex: false,
    });

    cachedConnection = await connectionPromise;

    if (!mongoose.connection._eventsRegistered) {
      mongoose.connection.on('disconnected', () => {
        cachedConnection = null;
        connectionPromise = null;
      });

      mongoose.connection.on('error', () => {
        cachedConnection = null;
        connectionPromise = null;
      });

      mongoose.connection._eventsRegistered = true;
    }

    return cachedConnection;
  } catch (err) {
    cachedConnection = null;
    connectionPromise = null;
    throw err;
  }
};

module.exports = connectDB;
