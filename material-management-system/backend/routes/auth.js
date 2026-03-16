const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
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
  body('email').optional().isEmail().normalizeEmail().withMessage('邮箱格式不正确'),
  body('password').isLength({ min: 6 }).withMessage('密码至少 6 个字符')
];

router.post('/register', authLimiter, registerValidation, authController.register);
router.post('/login', authLimiter, [
  body('username').trim().notEmpty().withMessage('请输入用户名'),
  body('password').notEmpty().withMessage('请输入密码')
], authController.login);
router.post('/email/send-verify', auth, authController.sendVerifyEmail);
router.post('/email/verify', auth, [
  body('code').trim().isLength({ min: 6, max: 6 }).withMessage('验证码格式不正确')
], authController.verifyEmail);
router.post('/password/forgot', [
  body('email').isEmail().normalizeEmail().withMessage('邮箱格式不正确')
], authController.forgotPassword);
router.post('/password/reset', [
  body('email').isEmail().normalizeEmail().withMessage('邮箱格式不正确'),
  body('code').trim().isLength({ min: 6, max: 6 }).withMessage('验证码格式不正确'),
  body('new_password').isLength({ min: 6 }).withMessage('密码至少 6 个字符')
], authController.resetPassword);
router.post('/password/change', auth, [
  body('old_password').notEmpty().withMessage('请输入旧密码'),
  body('new_password').isLength({ min: 6 }).withMessage('新密码至少 6 个字符')
], authController.changePassword);

module.exports = router;
