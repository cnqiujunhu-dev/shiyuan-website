const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const auth = require('../middleware/auth');

router.post('/platform-change', auth, applicationController.submitPlatformChange);
router.post('/print-report', auth, applicationController.submitPrintReport);
router.post('/buyback', auth, applicationController.submitBuyback);
router.get('/', auth, applicationController.getMyApplications);

module.exports = router;
