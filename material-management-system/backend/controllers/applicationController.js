const Application = require('../models/Application');
const Ownership = require('../models/Ownership');
const User = require('../models/User');
const logger = require('../config/logger');

exports.submitPlatformChange = async (req, res) => {
  const { new_platform } = req.body;
  const allowed = ['易次元', '橙光', '闪艺'];
  if (!allowed.includes(new_platform)) {
    return res.status(400).json({ message: '无效的平台' });
  }
  try {
    const user = await User.findById(req.user.id);
    if (user.platform_changed_at) {
      const daysSince = (Date.now() - user.platform_changed_at.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 365) {
        const remaining = Math.ceil(365 - daysSince);
        return res.status(400).json({ message: `距上次更换不足 365 天，还需等待 ${remaining} 天` });
      }
    }
    const pending = await Application.findOne({
      user_id: req.user.id,
      type: 'platform_change',
      status: 'pending'
    });
    if (pending) {
      return res.status(400).json({ message: '已有待审核的平台更换申请' });
    }
    await Application.create({
      type: 'platform_change',
      user_id: req.user.id,
      payload: { new_platform, old_platform: user.platform }
    });
    return res.json({ message: '申请已提交，等待审核' });
  } catch (err) {
    logger.error('submitPlatformChange error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.submitPrintReport = async (req, res) => {
  const { ownership_id, derivative_type, creator_id, creator_qq, copies, purpose } = req.body;
  const allowedDerivative = ['美工', 'Q版', 'CG', '无'];
  if (!allowedDerivative.includes(derivative_type)) {
    return res.status(400).json({ message: '无效的衍生类型' });
  }
  const copiesNum = parseInt(copies);
  if (isNaN(copiesNum) || copiesNum < 1 || copiesNum > 30) {
    return res.status(400).json({ message: '印刷份数须在 1-30 之间' });
  }
  try {
    const ownership = await Ownership.findOne({
      _id: ownership_id,
      user_id: req.user.id,
      active: true
    });
    if (!ownership) {
      return res.status(404).json({ message: '未找到素材持有记录' });
    }
    await Application.create({
      type: 'print_report',
      user_id: req.user.id,
      payload: { ownership_id, derivative_type, creator_id, creator_qq, copies: copiesNum, purpose }
    });
    return res.json({ message: '报备已提交，等待审核' });
  } catch (err) {
    logger.error('submitPrintReport error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.submitBuyback = async (req, res) => {
  const { ownership_id, reason } = req.body;
  if (!ownership_id) {
    return res.status(400).json({ message: '请提供要回购的素材记录 ID' });
  }
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.buyback_remaining <= 0) {
      return res.status(400).json({ message: '本年度回购次数已用完' });
    }
    // 验证该转让记录属于本人
    const ownership = await Ownership.findOne({
      _id: ownership_id,
      user_id: req.user.id,
      acquisition_type: 'transfer_out',
      active: true
    }).populate('item_id', 'name');
    if (!ownership) {
      return res.status(404).json({ message: '未找到可回购的转让记录' });
    }
    // 检查是否已有待审核的回购申请
    const pending = await Application.findOne({
      user_id: req.user.id,
      type: 'buyback',
      status: 'pending',
      'payload.ownership_id': ownership_id
    });
    if (pending) {
      return res.status(400).json({ message: '该素材已有待审核的回购申请' });
    }
    await Application.create({
      type: 'buyback',
      user_id: req.user.id,
      payload: {
        ownership_id: ownership._id,
        item_id: ownership.item_id?._id,
        item_name: ownership.item_id?.name,
        reason: reason || ''
      }
    });
    return res.json({ message: '回购申请已提交，等待管理员审核' });
  } catch (err) {
    logger.error('submitBuyback error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.getMyApplications = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = { user_id: req.user.id };
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
