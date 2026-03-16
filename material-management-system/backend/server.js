require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

// Connect to database
connectDB(process.env.MONGODB_URI);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static serve uploaded files (optional)
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.join(__dirname, uploadDir)));

// Routes
const authRoutes = require('./routes/auth');
const assetRoutes = require('./routes/assets');

app.use('/api/auth', authRoutes);
app.use('/api/assets', assetRoutes);

// Health check
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});