const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');

// Rate limit: 10 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: '请求过于频繁，请 15 分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false
});

const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('用户名长度须为 3-20 个字符')
    .matches(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/)
    .withMessage('用户名只能包含字母、数字、下划线或中文'),
  body('email').isEmail().normalizeEmail().withMessage('邮箱格式不正确'),
  body('password').isLength({ min: 6 }).withMessage('密码至少 6 个字符')
];

const loginValidation = [
  body('usernameOrEmail').trim().notEmpty().withMessage('请输入用户名或邮箱'),
  body('password').notEmpty().withMessage('请输入密码')
];

router.post('/register', authLimiter, registerValidation, authController.register);
router.post('/login', authLimiter, loginValidation, authController.login);

module.exports = router;
