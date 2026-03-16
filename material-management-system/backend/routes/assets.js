const express = require('express');
const router = express.Router();
const assetController = require('../controllers/assetController');
const auth = require('../middleware/auth');

router.get('/', auth, assetController.getMyAssets);
router.post('/transfer', auth, assetController.transferAsset);
router.post('/sponsor', auth, assetController.sponsorAsset);

module.exports = router;
