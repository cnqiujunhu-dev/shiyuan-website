const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Register a new user.
 * @param {Request} req
 * @param {Response} res
 */
exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: '用户名、邮箱和密码不能为空' });
  }
  try {
    // Check if user exists
    const existing = await User.findOne({
      $or: [{ username }, { email }]
    });
    if (existing) {
      return res.status(409).json({ message: '用户名或邮箱已被使用' });
    }
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    const user = await User.create({ username, email, password: hashed });
    return res.status(201).json({ message: '注册成功', userId: user._id });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: '服务器错误' });
  }
};

/**
 * Login user and return JWT token.
 * @param {Request} req
 * @param {Response} res
 */
exports.login = async (req, res) => {
  const { usernameOrEmail, password } = req.body;
  if (!usernameOrEmail || !password) {
    return res.status(400).json({ message: '用户名/邮箱和密码不能为空' });
  }
  try {
    const user = await User.findOne({
      $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }]
    });
    if (!user) {
      return res.status(401).json({ message: '用户不存在' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: '密码不正确' });
    }
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.status(200).json({
      message: '登录成功',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: '服务器错误' });
  }
};