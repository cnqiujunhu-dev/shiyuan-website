const nodemailer = require('nodemailer');
const logger = require('../config/logger');

const isMailConfigured = () =>
  process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS;

const getMailTimeout = () => parseInt(process.env.MAIL_TIMEOUT_MS, 10) || 10000;

const getMailDnsFamily = () => {
  const family = parseInt(process.env.MAIL_DNS_FAMILY, 10);
  return family === 4 || family === 6 ? family : undefined;
};

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!isMailConfigured()) return null;
  const mailOptions = {
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT) || 465,
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    },
    connectionTimeout: getMailTimeout(),
    greetingTimeout: getMailTimeout(),
    socketTimeout: getMailTimeout(),
    dnsTimeout: getMailTimeout()
  };
  const family = getMailDnsFamily();
  if (family) {
    mailOptions.family = family;
  }
  transporter = nodemailer.createTransport(mailOptions);
  return transporter;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendMail(to, subject, html) {
  const t = getTransporter();
  if (!t) {
    logger.info('Mail service not configured, printing to console', { to, subject, html });
    return;
  }
  await t.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to,
    subject,
    html
  });
}

async function sendVerifyEmail(email, code) {
  const subject = '【诸城叙梦】邮箱验证码';
  const html = `<p>您的邮箱验证码为：<strong>${code}</strong>，有效期 10 分钟，请勿泄露给他人。</p>`;
  if (!isMailConfigured()) {
    logger.warn('Mail not configured — verify code not sent', { email, code });
    throw new Error('邮件服务未配置，请联系管理员');
  }
  await sendMail(email, subject, html);
}

async function sendRegistrationCodeEmail(email, code) {
  const subject = '【诸城叙梦】注册验证码';
  const html = `
    <p>您正在注册诸城叙梦素材平台账号。</p>
    <p>本次注册验证码为：<strong>${code}</strong></p>
    <p>验证码有效期 10 分钟，请勿泄露给他人。如非本人操作，请忽略本邮件。</p>
  `;
  if (!isMailConfigured()) {
    logger.warn('Mail not configured — registration code not sent', { email, code });
    throw new Error('邮件服务未配置，请联系管理员');
  }
  await sendMail(email, subject, html);
}

async function sendLoginCodeEmail(email, code) {
  const subject = '【诸城叙梦】登录验证码';
  const html = `
    <p>您正在登录诸城叙梦素材平台。</p>
    <p>本次登录验证码为：<strong>${code}</strong></p>
    <p>验证码有效期 10 分钟，请勿泄露给他人。如非本人操作，请忽略本邮件。</p>
  `;
  if (!isMailConfigured()) {
    logger.warn('Mail not configured — login code not sent', { email, code });
    throw new Error('邮件服务未配置，请联系管理员');
  }
  await sendMail(email, subject, html);
}

async function sendRegistrationApprovedEmail(email, user = {}) {
  const subject = '【诸城叙梦】注册审核已通过';
  const html = `
    <p>您的诸城叙梦素材平台账号已通过审核，现在可以登录使用。</p>
    <p>自定义 ID：<strong>${escapeHtml(user.username)}</strong></p>
    <p>平台 UID：<strong>${escapeHtml(user.uid)}</strong></p>
    <p>请使用注册 QQ 接收验证码后登录。</p>
  `;
  if (!isMailConfigured()) {
    logger.warn('Mail not configured — registration approval not sent', { email, userId: user.id || user._id });
    throw new Error('邮件服务未配置，请联系管理员');
  }
  await sendMail(email, subject, html);
}

async function sendRegistrationRejectedEmail(email, user = {}, reason = '') {
  const subject = '【诸城叙梦】注册审核未通过';
  const safeReason = escapeHtml(reason || '本次注册申请暂未通过，请根据管理员说明调整后再联系处理。');
  const html = `
    <p>您的诸城叙梦素材平台注册申请暂未通过。</p>
    <p>自定义 ID：<strong>${escapeHtml(user.username)}</strong></p>
    <p>管理员说明：</p>
    <p style="white-space:pre-line;">${safeReason}</p>
  `;
  if (!isMailConfigured()) {
    logger.warn('Mail not configured — registration rejection not sent', { email, userId: user.id || user._id });
    throw new Error('邮件服务未配置，请联系管理员');
  }
  await sendMail(email, subject, html);
}

async function sendPasswordResetEmail(email, code) {
  const subject = '【诸城叙梦】密码重置验证码';
  const html = `<p>您的密码重置验证码为：<strong>${code}</strong>，有效期 10 分钟，请勿泄露给他人。</p>`;
  if (!isMailConfigured()) {
    logger.warn('Mail not configured — reset code not sent', { email, code });
    throw new Error('邮件服务未配置，请联系管理员');
  }
  await sendMail(email, subject, html);
}

module.exports = {
  sendVerifyEmail,
  sendRegistrationCodeEmail,
  sendLoginCodeEmail,
  sendRegistrationApprovedEmail,
  sendRegistrationRejectedEmail,
  sendPasswordResetEmail
};
