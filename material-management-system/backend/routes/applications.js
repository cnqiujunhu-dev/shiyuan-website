const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const auth = require('../middleware/auth');

// Removed: platform-change and print-report routes (deleted features)
router.post('/buyback', auth, applicationController.submitBuyback);
router.get('/', auth, applicationController.getMyApplications);

module.exports = router;
