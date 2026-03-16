const express = require('express');
const router = express.Router();
const userController = require('../../controllers/admin/userController');
const auth = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roles');

const adminGuard = [auth, requireRole('admin')];

router.get('/', adminGuard, userController.getUsers);
router.put('/:id', adminGuard, userController.updateUser);

module.exports = router;
