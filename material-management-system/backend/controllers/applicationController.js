const Application = require('../models/Application');
const logger = require('../config/logger');

exports.submitBuyback = async (req, res) => {
  return res.status(410).json({ message: '回购已改为管理员通过授权名单 Excel 直接导入，不再走申请审核' });
};

exports.getMyApplications = async (req, res) => {
  const { type, page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = { user_id: req.user.id };
    if (type) filter.type = type;
    const total = await Application.countDocuments(filter);
    const applications = await Application.find(filter)
      .sort({ created_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();
    return res.json({ total, page: pageNum, applications });
  } catch (err) {
    logger.error('getMyApplications error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
