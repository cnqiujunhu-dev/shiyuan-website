const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const RegistrationVerification = require('../models/RegistrationVerification');
const emailService = require('../services/emailService');
const logger = require('../config/logger');

const crypto = require('crypto');

function generateCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

function getValidationMessage(req) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;
  return errors.array()[0].msg;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashVerificationCode(email, code) {
  return crypto
    .createHash('sha256')
    .update(`${normalizeEmail(email)}:${code}:${process.env.JWT_SECRET || 'registration_code_secret'}`)
    .digest('hex');
}

function buildAuthResponse(user) {
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

  return {
    token,
    refreshToken,
    user: {
      id: user._id,
      username: user.username,
      roles: user.roles,
      vip_level: user.vip_level,
      points_total: user.points_total,
      annual_spend: user.annual_spend,
      transfer_remaining: user.transfer_remaining,
      buyback_remaining: user.buyback_remaining,
      skip_queue_remaining: user.skip_queue_remaining,
      platform: user.platform,
      platform_id: user.platform_id,
      email: user.email,
      email_verified_at: user.email_verified_at
    }
  };
}

exports.sendRegisterCode = async (req, res) => {
  const validationMessage = getValidationMessage(req);
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }
  const email = normalizeEmail(req.body.email);
  const { username } = req.body;
  try {
    const [emailExists, usernameExists] = await Promise.all([
      User.findOne({ email }),
      username ? User.findOne({ username }) : null
    ]);
    if (emailExists) {
      return res.status(409).json({ message: '邮箱已被使用，请直接登录或找回密码' });
    }
    if (usernameExists) {
      return res.status(409).json({ message: '用户名已被使用' });
    }

    const pending = await RegistrationVerification.findOne({ email }).lean();
    if (pending?.last_sent_at && pending.last_sent_at > new Date(Date.now() - 60 * 1000)) {
      return res.status(429).json({ message: '验证码已发送，请 1 分钟后再试' });
    }

    const code = generateCode();
    await RegistrationVerification.findOneAndUpdate(
      { email },
      {
        email,
        code_hash: hashVerificationCode(email, code),
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        last_sent_at: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    try {
      await emailService.sendRegistrationCodeEmail(email, code);
    } catch (mailErr) {
      await RegistrationVerification.deleteOne({ email });
      logger.error('Registration email send failed', { message: mailErr.message });
      return res.status(500).json({ message: mailErr.message || '邮件发送失败，请稍后重试' });
    }

    return res.json({ message: '验证码已发送，请查收邮箱', expiresIn: 600, resendAfter: 60 });
  } catch (err) {
    logger.error('sendRegisterCode error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.register = async (req, res) => {
  const validationMessage = getValidationMessage(req);
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }
  const { username, password, code } = req.body;
  const email = normalizeEmail(req.body.email);
  try {
    const [usernameExists, emailExists] = await Promise.all([
      User.findOne({ username }),
      User.findOne({ email })
    ]);
    if (usernameExists) {
      return res.status(409).json({ message: '用户名已被使用' });
    }
    if (emailExists) {
      return res.status(409).json({ message: '邮箱已被使用，请直接登录或找回密码' });
    }

    const verification = await RegistrationVerification
      .findOne({ email })
      .select('+code_hash');
    if (!verification) {
      return res.status(400).json({ message: '请先获取邮箱验证码' });
    }
    if (verification.expires_at < new Date()) {
      await RegistrationVerification.deleteOne({ _id: verification._id });
      return res.status(400).json({ message: '验证码已过期，请重新获取' });
    }
    if (verification.attempts >= 5) {
      return res.status(429).json({ message: '验证码错误次数过多，请重新获取验证码' });
    }

    const expectedHash = hashVerificationCode(email, code);
    if (verification.code_hash !== expectedHash) {
      verification.attempts += 1;
      await verification.save();
      return res.status(400).json({ message: '验证码不正确' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      password_hash,
      email,
      email_verified_at: new Date()
    });
    await RegistrationVerification.deleteOne({ _id: verification._id });

    logger.info('New user registered with verified email', { userId: user._id, username });
    return res.status(201).json({ message: '注册成功', ...buildAuthResponse(user) });
  } catch (err) {
    if (err.code === 11000) {
      if (err.keyPattern?.email) return res.status(409).json({ message: '邮箱已被使用' });
      if (err.keyPattern?.username) return res.status(409).json({ message: '用户名已被使用' });
    }
    logger.error('Register error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.login = async (req, res) => {
  const validationMessage = getValidationMessage(req);
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
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
    logger.info('User logged in', { userId: user._id, username: user.username });
    return res.status(200).json(buildAuthResponse(user));
  } catch (err) {
    logger.error('Login error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.sendVerifyEmail = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: '用户不存在' });

    const { email } = req.body || {};

    // If email is provided in request, bind it first (unverified)
    if (email) {
      const normalized = email.toLowerCase().trim();
      if (!/^\S+@\S+\.\S+$/.test(normalized)) {
        return res.status(400).json({ message: '邮箱格式不正确' });
      }
      // Check if email is already used by another user
      const existing = await User.findOne({ email: normalized, _id: { $ne: user._id } });
      if (existing) {
        return res.status(409).json({ message: '该邮箱已被其他用户使用' });
      }
      user.email = normalized;
      user.email_verified_at = null; // Reset verification status
    }

    if (!user.email) {
      return res.status(400).json({ message: '请先输入邮箱地址' });
    }

    const code = generateCode();
    user.email_verify_code = code;
    user.email_verify_expires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();
    try {
      await emailService.sendVerifyEmail(user.email, code);
    } catch (mailErr) {
      return res.status(500).json({ message: mailErr.message || '邮件发送失败' });
    }
    return res.json({ message: '验证码已发送至 ' + user.email });
  } catch (err) {
    logger.error('sendVerifyEmail error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.verifyEmail = async (req, res) => {
  const validationMessage = getValidationMessage(req);
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }
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
    return res.json({
      message: '邮箱验证成功',
      user: { email: user.email, email_verified_at: user.email_verified_at }
    });
  } catch (err) {
    logger.error('verifyEmail error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.forgotPassword = async (req, res) => {
  const validationMessage = getValidationMessage(req);
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }
  const { email } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase(), email_verified_at: { $ne: null } });
    if (user) {
      const code = generateCode();
      user.password_reset_code = code;
      user.password_reset_expires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
      await emailService.sendPasswordResetEmail(user.email, code);
    }
    return res.json({ message: '若该邮箱已注册且已验证，重置码已发送' });
  } catch (err) {
    logger.error('forgotPassword error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.resetPassword = async (req, res) => {
  const validationMessage = getValidationMessage(req);
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }
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
  const validationMessage = getValidationMessage(req);
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }
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
