require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');
const logger = require('./config/logger');

connectDB(process.env.MONGODB_URI || 'mongodb://localhost:27017/shiyuan');

const app = express();

app.use(helmet());

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) }
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.join(__dirname, uploadDir)));

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', globalLimiter);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/me', require('./routes/me'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/shop', require('./routes/shop'));
app.use('/api/admin/items', require('./routes/admin/items'));
app.use('/api/admin/transactions', require('./routes/admin/transactions'));
app.use('/api/admin/vips', require('./routes/admin/vips'));
app.use('/api/admin/users', require('./routes/admin/users'));
app.use('/api/admin/applications', require('./routes/admin/applications'));
app.use('/api/admin/transfers', require('./routes/admin/transfers'));

app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({
    status: dbState === 1 ? 'ok' : 'degraded',
    db: states[dbState] || 'unknown',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

app.use((req, res) => {
  res.status(404).json({ message: '接口不存在' });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { message: err.message, path: req.path, stack: err.stack });
  res.status(err.status || 500).json({ message: err.message || '服务器错误' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`, { env: process.env.NODE_ENV });
});

module.exports = app;
