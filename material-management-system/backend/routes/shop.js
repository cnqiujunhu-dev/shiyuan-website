const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const auth = require('../middleware/auth');

router.get('/items', shopController.getShopItems);
router.post('/items/:id/buy', auth, shopController.buySelf);
router.post('/items/:id/skip-queue', auth, shopController.skipQueueBuy);

module.exports = router;
