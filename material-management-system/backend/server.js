require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path');
const connectDB = require('./config/db');
const logger = require('./config/logger');

// Connect to database
connectDB(process.env.MONGODB_URI);

const app = express();

// Security headers
app.use(helmet());

// CORS - restrict to allowed origins in production
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:4173'];

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, curl, same-origin)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

// HTTP request logging
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) }
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Static serve uploaded files
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.join(__dirname, uploadDir)));

// Routes
const authRoutes = require('./routes/auth');
const assetRoutes = require('./routes/assets');

app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);

// Enhanced health check
app.get('/api/health', (_, res) => {
  const dbState = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({
    status: dbState === 1 ? 'ok' : 'degraded',
    db: states[dbState] || 'unknown',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: '接口不存在' });
});

// Global error handler
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', { message: err.message, path: req.path, stack: err.stack });
  res.status(err.status || 500).json({ message: err.message || '服务器错误' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`, { env: process.env.NODE_ENV });
});
