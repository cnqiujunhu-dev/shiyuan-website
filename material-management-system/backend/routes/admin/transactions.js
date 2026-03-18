const express = require('express');
const router = express.Router();
const transactionController = require('../../controllers/admin/transactionController');
const auth = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roles');

const adminGuard = [auth, requireRole('admin')];

router.post('/import', adminGuard, transactionController.importTransactions);
router.post('/import-authorizations', adminGuard, transactionController.importAuthorizations);
router.get('/', adminGuard, transactionController.getTransactions);

module.exports = router;
