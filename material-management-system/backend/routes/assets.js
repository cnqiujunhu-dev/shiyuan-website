const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const assetController = require('../controllers/assetController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Configure multer storage. Use env UPLOAD_DIR or default to uploads directory.
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Use timestamp + random string + original extension
    const ext = path.extname(file.originalname);
    const base = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${base}${ext}`);
  }
});
// Optional file filter: allow common types
const fileFilter = function (req, file, cb) {
  // Accept all for now. Could restrict by mime types.
  cb(null, true);
};
const upload = multer({ storage, fileFilter });

// Protected routes: require authentication
router.use(authMiddleware);

// Upload asset
router.post('/upload', upload.single('file'), assetController.uploadAsset);

// List assets with filters
router.get('/', assetController.getAssets);

// Get asset by id
router.get('/:id', assetController.getAssetById);

// Update asset metadata
router.put('/:id', assetController.updateAsset);

// Delete asset
router.delete('/:id', assetController.deleteAsset);

// Download asset
router.get('/download/:id', assetController.downloadAsset);

module.exports = router;