const express = require('express');
const multer = require('multer');
const router = express.Router();
const transactionController = require('../../controllers/admin/transactionController');
const auth = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roles');

const adminGuard = [auth, requireRole('admin')];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/import', adminGuard, transactionController.importTransactions);
router.post('/import-authorizations', adminGuard, upload.single('file'), transactionController.importAuthorizations);
router.get('/', adminGuard, transactionController.getTransactions);

module.exports = router;
