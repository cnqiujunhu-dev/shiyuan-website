const express = require('express');
const router = express.Router();
const meController = require('../controllers/meController');
const auth = require('../middleware/auth');

router.get('/summary', auth, meController.getSummary);
router.post('/identities', auth, meController.addIdentity);
router.get('/activities', auth, meController.getActivities);

module.exports = router;
