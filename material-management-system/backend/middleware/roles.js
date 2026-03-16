function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.roles)) {
      return res.status(403).json({ message: '权限不足' });
    }
    const hasRole = roles.some((r) => req.user.roles.includes(r));
    if (!hasRole) {
      return res.status(403).json({ message: '权限不足' });
    }
    next();
  };
}

module.exports = { requireRole };
