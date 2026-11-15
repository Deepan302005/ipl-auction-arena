const dns = require('dns');
const mongoose = require('mongoose');

// Configure Node.js to use Google DNS for MongoDB Atlas SRV lookups on Windows
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (dnsErr) {
  // Ignore
}

/**
 * Connect to MongoDB with environment-aware fallback rules:
 * - In production (process.env.NODE_ENV === 'production'):
 *     MUST connect to process.env.MONGODB_URI (e.g. Atlas).
 *     Throws error if missing or unreachable. NEVER silently falls back to local MongoDB.
 * - In development/test (process.env.NODE_ENV !== 'production'):
 *     Attempts MONGODB_URI first, then falls back to local MongoDB (127.0.0.1:27017).
 */
const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const uri = process.env.MONGODB_URI;
  const localUri = process.env.LOCAL_MONGODB_URI || 'mongodb://127.0.0.1:27017/ipl_auction_arena';

  if (isProduction) {
    if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
      const configErr = new Error('FATAL [MongoDB Production]: MONGODB_URI environment variable is not configured with valid credentials. Local fallback is strictly disabled in production.');
      console.error(`❌ ${configErr.message}`);
      throw configErr;
    }

    try {
      try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch (_) {}
      const conn = await mongoose.connect(uri, {
        dbName: 'ipl_auction_arena',
        serverSelectionTimeoutMS: 5000
      });
      console.log(`✅ [MongoDB Atlas Connected (Production)]: ${conn.connection.host} (DB: ${conn.connection.name})`);
      return { isConnected: true, host: conn.connection.host, database: conn.connection.name, isProduction: true };
    } catch (prodError) {
      console.error(`❌ [MongoDB Atlas Fatal]: Connection to Atlas failed in production mode: ${prodError.message}`);
      throw new Error(`Production database connection failure: ${prodError.message}. Local fallback is forbidden in production.`);
    }
  }

  // Development / Test mode:
  // 1. Try remote MongoDB URI (Atlas) if configured without placeholders
  if (uri && !uri.includes('<username>') && !uri.includes('<password>')) {
    try {
      try { dns.setServers(['8.8.8.8', '8.8.4.4']); } catch (_) {}
      const conn = await mongoose.connect(uri, {
        dbName: 'ipl_auction_arena',
        serverSelectionTimeoutMS: 2500
      });
      console.log(`✅ [MongoDB Atlas Connected (Dev)]: ${conn.connection.host} (DB: ${conn.connection.name})`);
      return { isConnected: true, host: conn.connection.host, database: conn.connection.name, isProduction: false };
    } catch (remoteError) {
      console.warn(`⚠️ [MongoDB Atlas Unreachable in Dev]: ${remoteError.message}`);
      console.log(`🔄 Falling back to local MongoDB at ${localUri} (permitted in dev/test)...`);
    }
  }

  // 2. Fall back to local MongoDB (development / test only)
  try {
    const localConn = await mongoose.connect(localUri, {
      dbName: 'ipl_auction_arena',
      serverSelectionTimeoutMS: 3000
    });
    console.log(`✅ [MongoDB Connected (Local Dev/Test)]: ${localConn.connection.host} (DB: ${localConn.connection.name})`);
    return { isConnected: true, host: localConn.connection.host, database: localConn.connection.name, isProduction: false };
  } catch (localError) {
    console.error(`❌ [MongoDB Connection Error]: Could not connect to Atlas or Local MongoDB: ${localError.message}`);
    return { isConnected: false, error: localError.message };
  }
};

module.exports = connectDB;
