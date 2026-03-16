const User = require('../../models/User');
const auditService = require('../../services/auditService');
const logger = require('../../config/logger');

exports.getUsers = async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = {};
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ username: re }, { qq: re }, { platform_id: re }, { email: re }];
    }
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password_hash')
      .sort({ created_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();
    return res.json({ total, page: pageNum, users });
  } catch (err) {
    logger.error('getUsers error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { platform, platform_id, qq } = req.body;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    const before = { platform: user.platform, platform_id: user.platform_id, qq: user.qq };
    if (platform !== undefined) user.platform = platform;
    if (platform_id !== undefined) user.platform_id = platform_id;
    if (qq !== undefined) user.qq = qq;
    await user.save();

    await auditService.log(req.user.id, 'update_user', 'User', user._id, before, { platform: user.platform, platform_id: user.platform_id, qq: user.qq }, req);
    return res.json({ message: '用户信息已更新', user });
  } catch (err) {
    logger.error('updateUser error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
