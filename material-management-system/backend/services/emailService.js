const nodemailer = require('nodemailer');
const logger = require('../config/logger');

const isMailConfigured = () =>
  process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS;

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
    }
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
    logger.info('Email verify code (dev mode)', { email, code });
    return;
  }
  await sendMail(email, subject, html);
}

async function sendPasswordResetEmail(email, code) {
  const subject = '【诸城叙梦】密码重置验证码';
  const html = `<p>您的密码重置验证码为：<strong>${code}</strong>，有效期 10 分钟，请勿泄露给他人。</p>`;
  if (!isMailConfigured()) {
    logger.info('Password reset code (dev mode)', { email, code });
    return;
  }
  await sendMail(email, subject, html);
}

module.exports = { sendVerifyEmail, sendPasswordResetEmail };
