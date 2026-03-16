const express = require('express');
const router = express.Router();
const transferController = require('../../controllers/admin/transferController');
const auth = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roles');

const adminGuard = [auth, requireRole('admin')];

router.get('/', adminGuard, transferController.getTransfers);
router.post('/:id/rollback', adminGuard, transferController.rollbackTransfer);

module.exports = router;
