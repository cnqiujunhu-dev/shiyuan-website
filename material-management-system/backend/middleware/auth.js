const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未提供授权令牌' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).lean();
    if (!user) {
      return res.status(401).json({ message: '令牌验证失败' });
    }
    req.user = {
      id: user._id.toString(),
      username: user.username,
      roles: user.roles,
      vip_level: user.vip_level
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: '令牌验证失败' });
  }
}

module.exports = auth;
