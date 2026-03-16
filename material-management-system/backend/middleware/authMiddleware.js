const jwt = require('jsonwebtoken');
const User = require('../models/user');

/**
 * Authentication middleware to verify JWT token.
 * Adds `req.user` with id and role if token is valid. Otherwise returns 401.
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未提供授权令牌' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Optionally fetch user from DB to verify existence
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: '无效的用户' });
    }
    req.user = { id: user._id.toString(), role: user.role, username: user.username };
    next();
  } catch (err) {
    return res.status(401).json({ message: '令牌验证失败' });
  }
}

module.exports = authMiddleware;