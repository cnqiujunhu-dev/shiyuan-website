const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');

router.get('/items', shopController.getShopItems);

module.exports = router;
