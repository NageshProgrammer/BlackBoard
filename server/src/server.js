const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const { createAdapter } = require('@socket.io/redis-adapter');

// Load environment variables
dotenv.config();

const logger = require('./utils/logger');
const connectDB = require('./config/db');
const { initRedis, isRedisConnected, getPubSubClients } = require('./config/redis');
const batchWriter = require('./socket/batchWriter');
const setupSocketHandlers = require('./socket/socketManager');

const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');

const app = express();
const server = http.createServer(app);

// Initialize database & Redis
connectDB();
initRedis();

// Express Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// REST API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// System Health & Metrics Check
app.get('/api/health', (req, res) => {
  const batchStats = batchWriter.getStats();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    redis: isRedisConnected() ? 'connected' : 'memory-fallback',
    batchWriter: batchStats
  });
});

// Serve frontend static build in production (e.g. on Render)
const path = require('path');
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  const indexPath = path.join(clientDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) next();
  });
});

// Configure Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  pingTimeout: 30000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e7 // 10MB
});

// Setup Redis Adapter if Redis is connected (for horizontal multi-server scaling)
setTimeout(() => {
  if (isRedisConnected()) {
    try {
      const { pubClient, subClient } = getPubSubClients();
      if (pubClient && subClient) {
        io.adapter(createAdapter(pubClient, subClient));
        logger.info('Socket.IO Redis Adapter configured for horizontal clustering');
      }
    } catch (err) {
      logger.warn(`Could not attach Redis adapter: ${err.message}`);
    }
  }
}, 1000);

// Initialize Socket Event Handlers
setupSocketHandlers(io);

// Export app and server for testing
const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    logger.info(`BoardCollab Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    logger.info(`Health check available at http://localhost:${PORT}/api/health`);
  });
}

// Graceful Shutdown
const handleShutdown = async () => {
  logger.info('Shutting down gracefully...');
  await batchWriter.destroy();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

module.exports = { app, server, io };
