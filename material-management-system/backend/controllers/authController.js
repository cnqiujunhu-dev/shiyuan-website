const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const logger = require('../config/logger');

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }
  const { username, email, password } = req.body;
  try {
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      return res.status(409).json({ message: '用户名或邮箱已被使用' });
    }
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    const user = await User.create({ username, email, password: hashed });
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
  const { usernameOrEmail, password } = req.body;
  try {
    const user = await User.findOne({
      $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }]
    });
    // Use identical error message to prevent user enumeration
    if (!user) {
      return res.status(401).json({ message: '用户名或密码不正确' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: '用户名或密码不正确' });
    }
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    logger.info('User logged in', { userId: user._id, username: user.username });
    return res.status(200).json({
      message: '登录成功',
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    logger.error('Login error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
