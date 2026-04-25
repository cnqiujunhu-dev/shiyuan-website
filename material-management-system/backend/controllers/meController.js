const User = require('../models/User');
const Transaction = require('../models/Transaction');
const logger = require('../config/logger');

function buildDateRangeStart(value) {
  return new Date(value);
}

function buildDateRangeEnd(value) {
  const date = new Date(value);
  if (!Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

exports.getSummary = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    return res.json({
      uid: user.uid,
      username: user.username,
      email: user.email,
      email_verified_at: user.email_verified_at,
      registration_status: user.registration_status || 'approved',
      qq: user.qq,
      platform: user.platform,
      platform_id: user.platform_id,
      roles: user.roles,
      vip_level: user.vip_level,
      points_total: user.points_total,
      annual_spend: user.annual_spend,
      transfer_remaining: user.transfer_remaining,
      buyback_remaining: user.buyback_remaining,
      skip_queue_remaining: user.skip_queue_remaining
    });
  } catch (err) {
    logger.error('getSummary error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.getActivities = async (req, res) => {
  const {
    type,
    from,
    to,
    start_date,
    end_date,
    page = 1,
    limit = 20
  } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const fromDate = from || start_date;
    const toDate = to || end_date;

    const filter = {
      $or: [{ actor_id: req.user.id }, { target_id: req.user.id }]
    };
    if (type) filter.type = type;
    if (fromDate || toDate) {
      filter.occurred_at = {};
      if (fromDate) filter.occurred_at.$gte = buildDateRangeStart(fromDate);
      if (toDate) filter.occurred_at.$lte = buildDateRangeEnd(toDate);
    }

    const total = await Transaction.countDocuments(filter);
    const transactions = await Transaction.find(filter)
      .sort({ occurred_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('item_id', 'name artist categories price preview_url')
      .lean();

    return res.json({ total, page: pageNum, transactions, activities: transactions });
  } catch (err) {
    logger.error('getActivities error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
