const mongoose = require('mongoose');

/**
 * Health check controller
 * Reports application, uptime, environment, socket and MongoDB connection status
 */
const getHealthStatus = (req, res) => {
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const readyState = mongoose.connection.readyState;
  const dbStatus = dbStates[readyState] || 'unknown';

  return res.status(200).json({
    success: true,
    message: 'IPL Auction Arena API is operating smoothly',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())} seconds`,
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    services: {
      api: {
        status: 'healthy',
        port: process.env.PORT || 5000
      },
      websocket: {
        status: 'initialized',
        path: '/socket.io'
      },
      database: {
        provider: 'MongoDB Atlas',
        status: dbStatus,
        connected: readyState === 1,
        host: readyState === 1 ? mongoose.connection.host : null,
        databaseName: readyState === 1 ? mongoose.connection.name : null
      }
    }
  });
};

module.exports = { getHealthStatus };
