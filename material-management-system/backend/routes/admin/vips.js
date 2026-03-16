const express = require('express');
const router = express.Router();
const vipController = require('../../controllers/admin/vipController');
const auth = require('../../middleware/auth');
const { requireRole } = require('../../middleware/roles');

const adminGuard = [auth, requireRole('admin')];

router.post('/import', adminGuard, vipController.importVips);
router.get('/levels', adminGuard, vipController.getLevels);
router.post('/levels', adminGuard, vipController.createLevel);
router.put('/levels/:id', adminGuard, vipController.updateLevel);
router.get('/customers', adminGuard, vipController.getVipCustomers);
router.patch('/customers/:id', adminGuard, vipController.updateVipCustomer);
router.post('/reset-counters', adminGuard, vipController.resetCounters);
router.post('/reset-annual-spend', adminGuard, vipController.resetAnnualSpend);

module.exports = router;
