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

const usernameValidation = () => body('username')
  .trim()
  .isLength({ min: 2, max: 30 })
  .withMessage('自定义 ID 长度须为 2-30 个字符')
  .matches(/^[^\r\n\t<>]+$/)
  .withMessage('自定义 ID 不能包含换行或尖括号');

const qqOrEmailValidation = () => body().custom((_, { req }) => {
  const qq = String(req.body?.qq || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (qq) {
    if (!/^\d{5,12}$/.test(qq)) throw new Error('QQ 号格式不正确');
    return true;
  }
  if (!email) throw new Error('请输入 QQ 号');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('邮箱格式不正确');
  const domain = email.split('@')[1];
  if (!['qq.com', 'vip.qq.com', 'foxmail.com'].includes(domain)) {
    throw new Error('请使用 QQ 邮箱注册');
  }
  return true;
});

const identityValidation = () => body().custom((_, { req }) => {
  const source = req.body?.identity || req.body || {};
  const role = String(source.role || source.identity_role || '').trim();
  const platform = String(source.platform || '').trim();
  const nickname = String(source.nickname || source.platform_id || source.circle_name || '').trim();
  if (!role) throw new Error('请选择职业');
  if (!platform) throw new Error('请选择平台');
  if (!nickname) throw new Error('请输入圈名');
  if (role.length > 30) throw new Error('职业长度不能超过 30 个字符');
  if (platform.length > 30) throw new Error('平台长度不能超过 30 个字符');
  if (nickname.length > 50) throw new Error('圈名长度不能超过 50 个字符');
  if (/[<>\r\n\t]/.test(`${role}${platform}${nickname}`)) {
    throw new Error('身份信息不能包含换行、制表符或尖括号');
  }
  return true;
});

const qqValidation = () => body('qq')
  .trim()
  .matches(/^\d{5,12}$/)
  .withMessage('QQ 号格式不正确');

const registerValidation = [
  qqValidation()
];

const registerCodeValidation = [
  qqValidation()
];

const verifyCodeValidation = [
  qqValidation(),
  body('code').trim().isLength({ min: 6, max: 6 }).withMessage('验证码格式不正确')
];

router.post('/register/send-code', authLimiter, registerCodeValidation, authController.sendRegisterCode);
router.post('/register/verify-code', authLimiter, verifyCodeValidation, authController.verifyRegisterCode);
router.post('/register', authLimiter, registerValidation, authController.register);
router.post('/login/send-code', authLimiter, registerCodeValidation, authController.sendLoginCode);
router.post('/login/code', authLimiter, verifyCodeValidation, authController.loginWithCode);
router.post('/login', authLimiter, [
  body('username').trim().notEmpty().withMessage('请输入自定义 ID'),
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
