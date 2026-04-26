const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Application = require('../models/Application');
const RegistrationVerification = require('../models/RegistrationVerification');
const emailService = require('../services/emailService');
const logger = require('../config/logger');
const {
  normalizeIdentity,
  normalizeIdentities,
  getIdentityValidationMessage,
  serializeIdentities
} = require('../utils/identity');

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

function normalizeQq(qq) {
  return String(qq || '').trim();
}

function isValidQq(qq) {
  return /^\d{5,12}$/.test(normalizeQq(qq));
}

function isQQEmail(email) {
  const domain = normalizeEmail(email).split('@')[1];
  return ['qq.com', 'vip.qq.com', 'foxmail.com'].includes(domain);
}

function getQqFromEmail(email) {
  const [local, domain] = normalizeEmail(email).split('@');
  if (domain === 'qq.com' && /^\d+$/.test(local)) return local;
  return undefined;
}

function getRegistrationContact(body = {}) {
  const qq = normalizeQq(body.qq);
  if (qq) {
    if (!isValidQq(qq)) {
      return { error: 'QQ 号格式不正确' };
    }
    return { qq, email: `${qq}@qq.com` };
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return { error: '请输入 QQ 号' };
  }
  if (!isQQEmail(email)) {
    return { error: '请使用 QQ 邮箱注册' };
  }
  return { email, qq: getQqFromEmail(email) };
}

function getQqContact(body = {}) {
  const qq = normalizeQq(body.qq);
  if (!isValidQq(qq)) {
    return { error: 'QQ 号格式不正确' };
  }
  return { qq, email: `${qq}@qq.com` };
}

function validateVerificationRecord(verification, email, code) {
  if (!verification) return '请先获取验证码';
  if (verification.expires_at < new Date()) return '验证码已过期，请重新获取';
  if (verification.attempts >= 5) return '验证码错误次数过多，请重新获取验证码';
  if (verification.code_hash !== hashVerificationCode(email, code)) return '验证码不正确';
  return null;
}

async function markVerificationCodeVerified(email, code) {
  const verification = await RegistrationVerification
    .findOne({ email })
    .select('+code_hash');
  const message = validateVerificationRecord(verification, email, code);
  if (message) {
    if (verification && message === '验证码不正确') {
      verification.attempts += 1;
      await verification.save();
    }
    if (verification && message === '验证码已过期') {
      await RegistrationVerification.deleteOne({ _id: verification._id });
    }
    return { error: message };
  }
  verification.verified_at = new Date();
  verification.attempts = 0;
  await verification.save();
  return { verification };
}

async function consumeVerifiedCode(email) {
  const verification = await RegistrationVerification.findOne({ email });
  if (!verification || !verification.verified_at) {
    return { error: '请先完成 QQ 邮箱验证码验证' };
  }
  if (verification.expires_at < new Date()) {
    await RegistrationVerification.deleteOne({ _id: verification._id });
    return { error: '验证码已过期，请重新获取' };
  }
  await RegistrationVerification.deleteOne({ _id: verification._id });
  return {};
}

async function verifyAndDeleteCode(email, code) {
  const verification = await RegistrationVerification
    .findOne({ email })
    .select('+code_hash');
  const message = validateVerificationRecord(verification, email, code);
  if (message) {
    if (verification && message === '验证码不正确') {
      verification.attempts += 1;
      await verification.save();
    }
    if (verification && message === '验证码已过期') {
      await RegistrationVerification.deleteOne({ _id: verification._id });
    }
    return { error: message };
  }
  await RegistrationVerification.deleteOne({ _id: verification._id });
  return {};
}

async function storeVerificationCode(email, code) {
  return RegistrationVerification.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        code_hash: hashVerificationCode(email, code),
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
        last_sent_at: new Date()
      },
      $unset: { verified_at: '' }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function buildUniqueUsername(base, qq, currentId) {
  const rawBase = String(base || `QQ${qq}`).trim().replace(/[<>\r\n\t]/g, '');
  const normalizedBase = (rawBase || `QQ${qq}`).slice(0, 30);
  const candidates = [
    normalizedBase,
    `${normalizedBase}_${String(qq).slice(-4)}`.slice(0, 30)
  ];
  for (let i = 0; i < 5; i++) {
    candidates.push(`${normalizedBase}_${crypto.randomBytes(2).toString('hex')}`.slice(0, 30));
  }
  for (const candidate of candidates) {
    const exists = await User.exists({ username: candidate, _id: { $ne: currentId } });
    if (!exists) return candidate;
  }
  return `QQ${qq}_${Date.now().toString().slice(-6)}`.slice(0, 30);
}

function getRegistrationStatus(user) {
  return user.registration_status || 'approved';
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
      uid: user.uid,
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
      qq: user.qq,
      identities: serializeIdentities(user),
      email: user.email,
      email_verified_at: user.email_verified_at,
      registration_status: getRegistrationStatus(user)
    }
  };
}

function getMailErrorMessage(err) {
  const message = err?.message || '';
  if (/timeout|ETIMEDOUT/i.test(message)) {
    return '邮件服务连接超时，请联系管理员检查 SMTP 配置';
  }
  if (/auth|EAUTH|Invalid login|Authentication/i.test(message)) {
    return '邮件服务认证失败，请联系管理员检查 SMTP 账号或授权码';
  }
  return '邮件发送失败，请稍后重试';
}

exports.sendRegisterCode = async (req, res) => {
  const validationMessage = getValidationMessage(req);
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }
  const contact = getQqContact(req.body);
  if (contact.error) {
    return res.status(400).json({ message: contact.error });
  }
  const { email } = contact;
  try {
    const emailExists = await User.findOne({ email });
    if (emailExists && getRegistrationStatus(emailExists) !== 'rejected') {
      const message = getRegistrationStatus(emailExists) === 'pending'
        ? '该 QQ 的注册申请正在审核中'
        : '该 QQ 已注册，请直接登录';
      return res.status(409).json({ message });
    }

    const pending = await RegistrationVerification.findOne({ email }).lean();
    if (pending?.last_sent_at && pending.last_sent_at > new Date(Date.now() - 60 * 1000)) {
      return res.status(429).json({ message: '验证码已发送，请 1 分钟后再试' });
    }

    const code = generateCode();
    await storeVerificationCode(email, code);

    try {
      await emailService.sendRegistrationCodeEmail(email, code);
    } catch (mailErr) {
      await RegistrationVerification.deleteOne({ email });
      logger.error('Registration email send failed', { message: mailErr.message });
      return res.status(500).json({ message: getMailErrorMessage(mailErr) });
    }

    return res.json({ message: '验证码已发送，请查收邮箱', expiresIn: 600, resendAfter: 60 });
  } catch (err) {
    logger.error('sendRegisterCode error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.verifyRegisterCode = async (req, res) => {
  const validationMessage = getValidationMessage(req);
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }
  const contact = getQqContact(req.body);
  if (contact.error) {
    return res.status(400).json({ message: contact.error });
  }
  try {
    const result = await markVerificationCodeVerified(contact.email, String(req.body.code || '').trim());
    if (result.error) {
      return res.status(400).json({ message: result.error });
    }
    return res.json({
      message: 'QQ 邮箱验证成功，请继续登记身份',
      qq: contact.qq,
      email: contact.email,
      verified: true
    });
  } catch (err) {
    logger.error('verifyRegisterCode error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.register = async (req, res) => {
  const validationMessage = getValidationMessage(req);
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }
  const contact = getQqContact(req.body);
  if (contact.error) {
    return res.status(400).json({ message: contact.error });
  }
  const { email, qq } = contact;

  const identities = normalizeIdentities(req.body.identities || req.body.identity || []);
  if (identities.length === 0) {
    return res.status(400).json({ message: '请至少填写一个身份' });
  }
  if (identities.length > 10) {
    return res.status(400).json({ message: '最多可一次提交 10 个身份' });
  }
  for (const identity of identities) {
    const identityValidationMessage = getIdentityValidationMessage(identity);
    if (identityValidationMessage) {
      return res.status(400).json({ message: identityValidationMessage });
    }
  }
  try {
    const emailExists = await User.findOne({ email });
    if (emailExists && getRegistrationStatus(emailExists) !== 'rejected') {
      const message = getRegistrationStatus(emailExists) === 'pending'
        ? '该 QQ 的注册申请正在审核中'
        : '该 QQ 已注册，请直接登录';
      return res.status(409).json({ message });
    }

    const verified = await consumeVerifiedCode(email);
    if (verified.error) {
      return res.status(400).json({ message: verified.error });
    }

    const primaryIdentity = identities[0];
    const username = await buildUniqueUsername(primaryIdentity.nickname, qq, emailExists?._id);
    const password_hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    let user;
    const verifiedAt = new Date();
    const identityDocs = identities.map((identity, index) => ({
      ...identity,
      is_primary: index === 0,
      status: 'pending',
      submitted_at: verifiedAt
    }));
    if (emailExists && getRegistrationStatus(emailExists) === 'rejected') {
      user = emailExists;
      user.username = username;
      user.password_hash = password_hash;
      user.email = email;
      user.qq = qq || user.qq || getQqFromEmail(email);
      user.email_verified_at = verifiedAt;
      user.platform = primaryIdentity.platform;
      user.platform_id = primaryIdentity.nickname;
      user.identities = identityDocs;
      user.registration_status = 'pending';
      user.registration_reviewed_by = undefined;
      user.registration_reviewed_at = undefined;
      user.registration_reject_reason = undefined;
      await user.save();
    } else {
      user = await User.create({
        username,
        password_hash,
        email,
        qq: qq || getQqFromEmail(email),
        platform: primaryIdentity.platform,
        platform_id: primaryIdentity.nickname,
        identities: identityDocs,
        email_verified_at: verifiedAt,
        registration_status: 'pending'
      });
    }

    await Application.create({
      type: 'registration',
      user_id: user._id,
      payload: {
        username: user.username,
        email: user.email,
        qq: user.qq,
        uid: user.uid,
        identities
      }
    });

    logger.info('New user registration submitted for review', { userId: user._id, username, uid: user.uid });
    return res.status(201).json({
      message: '注册申请已提交，审核通过后会发送邮件通知您登录',
      user: {
        id: user._id,
        uid: user.uid,
        username: user.username,
        qq: user.qq,
        email: user.email,
        email_verified_at: user.email_verified_at,
        identities: serializeIdentities(user),
        registration_status: getRegistrationStatus(user)
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      if (err.keyPattern?.email) return res.status(409).json({ message: '邮箱已被使用' });
      if (err.keyPattern?.username) return res.status(409).json({ message: '自定义 ID 已被使用' });
      if (err.keyPattern?.uid) return res.status(409).json({ message: 'UID 生成冲突，请重试' });
    }
    logger.error('Register error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

async function passwordLogin(req, res, options = {}) {
  const { requireAdmin = false, logLabel = 'User logged in' } = options;
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
    if (requireAdmin && !user.roles?.includes('admin')) {
      return res.status(403).json({ message: '无管理员权限' });
    }
    if (!requireAdmin && !user.roles?.includes('admin')) {
      return res.status(403).json({ message: '普通用户请使用 QQ 验证码登录' });
    }
    const registrationStatus = getRegistrationStatus(user);
    if (registrationStatus === 'pending') {
      return res.status(403).json({ message: '账号注册申请正在审核中，审核通过后会邮件通知您登录' });
    }
    if (registrationStatus === 'rejected') {
      const reason = user.registration_reject_reason ? `：${user.registration_reject_reason}` : '';
      return res.status(403).json({ message: `注册审核未通过${reason}` });
    }
    logger.info(logLabel, { userId: user._id, username: user.username });
    return res.status(200).json(buildAuthResponse(user));
  } catch (err) {
    logger.error(`${logLabel} error`, { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
}

exports.login = async (req, res) => {
  return passwordLogin(req, res, { requireAdmin: false, logLabel: 'Password login' });
};

exports.adminLogin = async (req, res) => {
  return passwordLogin(req, res, { requireAdmin: true, logLabel: 'Admin logged in' });
};

exports.sendLoginCode = async (req, res) => {
  const validationMessage = getValidationMessage(req);
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }
  const contact = getQqContact(req.body);
  if (contact.error) {
    return res.status(400).json({ message: contact.error });
  }
  try {
    const user = await User.findOne({ qq: contact.qq });
    if (!user) {
      return res.status(404).json({ message: '未找到该 QQ 对应的账号，请先注册' });
    }
    const registrationStatus = getRegistrationStatus(user);
    if (registrationStatus === 'pending') {
      return res.status(403).json({ message: '账号注册申请正在审核中，审核通过后会邮件通知您登录' });
    }
    if (registrationStatus === 'rejected') {
      const reason = user.registration_reject_reason ? `：${user.registration_reject_reason}` : '';
      return res.status(403).json({ message: `注册审核未通过${reason}` });
    }

    const code = generateCode();
    await storeVerificationCode(contact.email, code);
    try {
      await emailService.sendLoginCodeEmail(contact.email, code);
    } catch (mailErr) {
      await RegistrationVerification.deleteOne({ email: contact.email });
      logger.error('Login email send failed', { message: mailErr.message });
      return res.status(500).json({ message: getMailErrorMessage(mailErr) });
    }
    return res.json({ message: '验证码已发送，请查收 QQ 邮箱', expiresIn: 600, resendAfter: 60 });
  } catch (err) {
    logger.error('sendLoginCode error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.loginWithCode = async (req, res) => {
  const validationMessage = getValidationMessage(req);
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage });
  }
  const contact = getQqContact(req.body);
  if (contact.error) {
    return res.status(400).json({ message: contact.error });
  }
  try {
    const verification = await verifyAndDeleteCode(contact.email, String(req.body.code || '').trim());
    if (verification.error) {
      return res.status(400).json({ message: verification.error });
    }

    const user = await User.findOne({ qq: contact.qq });
    if (!user) {
      return res.status(404).json({ message: '未找到该 QQ 对应的账号，请先注册' });
    }
    const registrationStatus = getRegistrationStatus(user);
    if (registrationStatus === 'pending') {
      return res.status(403).json({ message: '账号注册申请正在审核中，审核通过后会邮件通知您登录' });
    }
    if (registrationStatus === 'rejected') {
      const reason = user.registration_reject_reason ? `：${user.registration_reject_reason}` : '';
      return res.status(403).json({ message: `注册审核未通过${reason}` });
    }
    logger.info('User logged in with QQ code', { userId: user._id, qq: contact.qq });
    return res.status(200).json(buildAuthResponse(user));
  } catch (err) {
    logger.error('loginWithCode error', { message: err.message });
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
      logger.error('Verify email send failed', { message: mailErr.message });
      return res.status(500).json({ message: getMailErrorMessage(mailErr) });
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
      try {
        await emailService.sendPasswordResetEmail(user.email, code);
      } catch (mailErr) {
        logger.error('Password reset email send failed', { message: mailErr.message });
        return res.status(500).json({ message: getMailErrorMessage(mailErr) });
      }
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
