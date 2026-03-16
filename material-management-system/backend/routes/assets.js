const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body } = require('express-validator');
const assetController = require('../controllers/assetController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed file types (MIME + extension double validation)
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/wav', 'audio/ogg',
  'application/pdf',
  'application/zip', 'application/x-zip-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv'
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.mp4', '.webm', '.mov',
  '.mp3', '.wav', '.ogg',
  '.pdf', '.zip', '.docx', '.xlsx', '.pptx',
  '.txt', '.csv'
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
    return cb(new Error(`不支持的文件类型: ${ext || file.mimetype}`), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Multer error handler
const uploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: '文件大小不能超过 100MB' });
      }
      return res.status(400).json({ message: err.message });
    }
    if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

const updateValidation = [
  body('description').optional().trim().isLength({ max: 500 }).withMessage('描述不能超过 500 字'),
  body('category').optional().trim().isLength({ max: 50 }).withMessage('分类不能超过 50 字')
];

// All routes require authentication
router.use(authMiddleware);

router.post('/upload', uploadMiddleware, assetController.uploadAsset);
router.get('/', assetController.getAssets);
// NOTE: /download/:id must come before /:id to avoid route conflict
router.get('/download/:id', assetController.downloadAsset);
router.get('/:id', assetController.getAssetById);
router.put('/:id', updateValidation, assetController.updateAsset);
router.delete('/:id', assetController.deleteAsset);

module.exports = router;
