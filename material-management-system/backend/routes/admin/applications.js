const express = require('express');
const router = express.Router();
const applicationController = require('../../controllers/admin/applicationController');
const auth = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roles');

const reviewerGuard = [auth, requireRole('admin', 'reviewer')];

router.get('/', reviewerGuard, applicationController.getApplications);
router.patch('/:id', reviewerGuard, applicationController.decideApplication);

module.exports = router;
