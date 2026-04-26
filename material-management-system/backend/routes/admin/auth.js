const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../../controllers/authController');

const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: '请求过于频繁，请 15 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/login', adminAuthLimiter, [
  body('username').trim().notEmpty().withMessage('请输入管理员用户名'),
  body('password').notEmpty().withMessage('请输入密码')
], authController.adminLogin);

module.exports = router;
