const nodemailer = require('nodemailer');
const logger = require('../config/logger');

const isMailConfigured = () =>
  process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS;

const getMailTimeout = () => parseInt(process.env.MAIL_TIMEOUT_MS, 10) || 10000;

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!isMailConfigured()) return null;
  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT) || 465,
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    },
    connectionTimeout: getMailTimeout(),
    greetingTimeout: getMailTimeout(),
    socketTimeout: getMailTimeout()
  });
  return transporter;
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

async function sendPasswordResetEmail(email, code) {
  const subject = '【诸城叙梦】密码重置验证码';
  const html = `<p>您的密码重置验证码为：<strong>${code}</strong>，有效期 10 分钟，请勿泄露给他人。</p>`;
  if (!isMailConfigured()) {
    logger.warn('Mail not configured — reset code not sent', { email, code });
    throw new Error('邮件服务未配置，请联系管理员');
  }
  await sendMail(email, subject, html);
}

module.exports = { sendVerifyEmail, sendRegistrationCodeEmail, sendPasswordResetEmail };
