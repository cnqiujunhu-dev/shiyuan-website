const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const emailService = require('../services/emailService');
const logger = require('../config/logger');

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  const { username, password, email } = req.body;
  try {
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(409).json({ message: '用户名已被使用' });
    }
    if (email) {
      const emailExists = await User.findOne({ email: email.toLowerCase() });
      if (emailExists) {
        return res.status(409).json({ message: '邮箱已被使用' });
      }
    }
    const password_hash = await bcrypt.hash(password, 10);
    const userData = { username, password_hash };
    if (email) userData.email = email.toLowerCase();

    const user = await User.create(userData);
    // TODO: 检查是否有老VIP导入记录（通过qq/email匹配，如有则同步vip信息）
    logger.info('New user registered', { userId: user._id, username });
    return res.status(201).json({ message: '注册成功', userId: user._id });
  } catch (err) {
    logger.error('Register error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: '用户名或密码不正确' });
    }
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: '用户名或密码不正确' });
    }
    const token = jwt.sign(
      { id: user._id, username: user.username, roles: user.roles, vip_level: user.vip_level },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    const refreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    logger.info('User logged in', { userId: user._id, username: user.username });
    return res.status(200).json({
      token,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        roles: user.roles,
        vip_level: user.vip_level,
        points_total: user.points_total,
        platform: user.platform,
        platform_id: user.platform_id,
        email: user.email,
        email_verified_at: user.email_verified_at
      }
    });
  } catch (err) {
    logger.error('Login error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.sendVerifyEmail = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.email) {
      return res.status(400).json({ message: '未绑定邮箱' });
    }
    const code = generateCode();
    user.email_verify_code = code;
    user.email_verify_expires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    await emailService.sendVerifyEmail(user.email, code);
    return res.json({ message: '验证码已发送' });
  } catch (err) {
    logger.error('sendVerifyEmail error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.verifyEmail = async (req, res) => {
  const { code } = req.body;
  try {
    const user = await User.findById(req.user.id).select('+email_verify_code +email_verify_expires');
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    if (!user.email_verify_code || user.email_verify_code !== code) {
      return res.status(400).json({ message: '验证码不正确' });
    }
    if (!user.email_verify_expires || user.email_verify_expires < new Date()) {
      return res.status(400).json({ message: '验证码已过期' });
    }
    user.email_verified_at = new Date();
    user.email_verify_code = undefined;
    user.email_verify_expires = undefined;
    await user.save();
    return res.json({ message: '邮箱验证成功' });
  } catch (err) {
    logger.error('verifyEmail error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase(), email_verified_at: { $ne: null } });
    if (user) {
      const code = generateCode();
      user.password_reset_code = code;
      user.password_reset_expires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
      await emailService.sendPasswordResetEmail(email, code);
    }
    return res.json({ message: '若该邮箱已注册且已验证，重置码已发送' });
  } catch (err) {
    logger.error('forgotPassword error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, code, new_password } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password_reset_code +password_reset_expires');
    if (!user || !user.password_reset_code || user.password_reset_code !== code) {
      return res.status(400).json({ message: '重置码不正确' });
    }
    if (!user.password_reset_expires || user.password_reset_expires < new Date()) {
      return res.status(400).json({ message: '重置码已过期' });
    }
    user.password_hash = await bcrypt.hash(new_password, 10);
    user.password_reset_code = undefined;
    user.password_reset_expires = undefined;
    await user.save();
    return res.json({ message: '密码已重置' });
  } catch (err) {
    logger.error('resetPassword error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.changePassword = async (req, res) => {
  const { old_password, new_password } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    const isMatch = await bcrypt.compare(old_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: '旧密码不正确' });
    }
    user.password_hash = await bcrypt.hash(new_password, 10);
    await user.save();
    return res.json({ message: '密码已修改' });
  } catch (err) {
    logger.error('changePassword error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
