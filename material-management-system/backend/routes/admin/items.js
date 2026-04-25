const express = require('express');
const router = express.Router();
const itemController = require('../../controllers/admin/itemController');
const auth = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roles');

const adminGuard = [auth, requireRole('admin')];

router.post('/', adminGuard, itemController.uploadMiddleware, itemController.createItem);
router.post('/import', adminGuard, itemController.importItems);
router.put('/:id', adminGuard, itemController.uploadMiddleware, itemController.updateItem);
router.get('/', adminGuard, itemController.getItems);
router.get('/:id', adminGuard, itemController.getItemById);
router.get('/:id/ownerships', adminGuard, itemController.getItemOwnerships);
router.get('/:id/ownerships/export', adminGuard, itemController.exportItemOwnerships);
router.patch('/:id/ownerships/:ownershipId', adminGuard, itemController.updateItemOwnership);

module.exports = router;
