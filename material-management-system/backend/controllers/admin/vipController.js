const User = require('../../models/User');
const VipLevel = require('../../models/VipLevel');
const auditService = require('../../services/auditService');
const logger = require('../../config/logger');

async function findOrCreateUserByEmailOrQq(email, qq) {
  let user = null;
  if (email) user = await User.findOne({ email: email.toLowerCase() });
  if (!user && qq) user = await User.findOne({ qq });
  if (!user) {
    const username = qq || email || `stub_${Date.now()}`;
    user = await User.create({
      username,
      password_hash: 'IMPORTED',
      email: email ? email.toLowerCase() : undefined,
      qq: qq || undefined
    });
  }
  return user;
}

exports.importVips = async (req, res) => {
  const records = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ message: '请提供有效的VIP记录数组' });
  }

  let imported = 0;
  const failed = [];

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    try {
      const user = await findOrCreateUserByEmailOrQq(rec.email, rec.qq);
      const vipLevelDoc = await VipLevel.findOne({ level: Number(rec.vip_level) });

      user.vip_level = Number(rec.vip_level) || 0;
      user.points_total = Number(rec.points) || 0;

      if (vipLevelDoc) {
        user.transfer_remaining = vipLevelDoc.perks.transfer_per_year;
        user.buyback_remaining = vipLevelDoc.perks.buyback_per_year;
        user.skip_queue_remaining = vipLevelDoc.perks.skip_queue_per_year || 0;
        if (!user.roles.includes('vip')) user.roles.push('vip');
      }

      await user.save();
      imported++;
    } catch (err) {
      failed.push({ index: i, record: rec, error: err.message });
    }
  }

  logger.info('VIPs imported', { imported, failed: failed.length });
  return res.json({ imported, failed });
};

exports.getLevels = async (req, res) => {
  try {
    const levels = await VipLevel.find().sort({ level: 1 }).lean();
    return res.json({ levels });
  } catch (err) {
    logger.error('getLevels error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.createLevel = async (req, res) => {
  try {
    const { level, threshold, perks } = req.body;
    const existing = await VipLevel.findOne({ level });
    if (existing) {
      return res.status(409).json({ message: '该等级已存在' });
    }
    const vipLevel = await VipLevel.create({ level, threshold, perks });
    return res.status(201).json({ message: '等级创建成功', vipLevel });
  } catch (err) {
    logger.error('createLevel error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.updateLevel = async (req, res) => {
  const { id } = req.params;
  try {
    const { threshold, perks, active } = req.body;
    const updates = {};
    if (threshold !== undefined) updates.threshold = threshold;
    if (perks !== undefined) updates.perks = perks;
    if (active !== undefined) updates.active = active;
    const vipLevel = await VipLevel.findByIdAndUpdate(id, updates, { new: true });
    if (!vipLevel) {
      return res.status(404).json({ message: 'VIP等级不存在' });
    }
    return res.json({ message: '等级已更新', vipLevel });
  } catch (err) {
    logger.error('updateLevel error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.getVipCustomers = async (req, res) => {
  const { vip_level, page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = { vip_level: { $gte: 1 } };
    if (vip_level) filter.vip_level = Number(vip_level);
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('username platform platform_id qq vip_level points_total annual_spend transfer_remaining buyback_remaining')
      .sort({ vip_level: -1, points_total: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();
    return res.json({ total, page: pageNum, users });
  } catch (err) {
    logger.error('getVipCustomers error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.resetCounters = async (req, res) => {
  const { vip_level } = req.body;
  try {
    let levelsToReset = [];
    if (vip_level !== undefined) {
      const lvl = await VipLevel.findOne({ level: Number(vip_level) });
      if (lvl) levelsToReset = [lvl];
    } else {
      levelsToReset = await VipLevel.find({ active: true });
    }

    let updated = 0;
    for (const lvl of levelsToReset) {
      const result = await User.updateMany(
        { vip_level: lvl.level },
        {
          transfer_remaining: lvl.perks.transfer_per_year,
          buyback_remaining: lvl.perks.buyback_per_year,
          skip_queue_remaining: lvl.perks.skip_queue_per_year || 0
        }
      );
      updated += result.modifiedCount;
    }

    await auditService.log(req.user.id, 'reset_counters', 'User', null, null, { vip_level, updated }, req);
    logger.info('VIP counters reset', { vip_level, updated });
    return res.json({ updated });
  } catch (err) {
    logger.error('resetCounters error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.resetAnnualSpend = async (req, res) => {
  try {
    // 获取所有激活的 VIP 等级配置（升序）
    const vipLevels = await VipLevel.find({ active: true }).sort({ threshold: 1 }).lean();

    // 先读取所有 VIP 用户的当前 annual_spend（重置前）
    const vipUsers = await User.find({ vip_level: { $gt: 0 } })
      .select('_id vip_level annual_spend');

    let downgraded = 0;

    // 逐用户计算：基于 annual_spend 能保持的最高等级
    for (const user of vipUsers) {
      let qualifyLevel = 0;
      for (const lvl of vipLevels) {
        if (user.annual_spend >= lvl.threshold) qualifyLevel = lvl.level;
      }

      if (qualifyLevel < user.vip_level) {
        const newLvlDoc = vipLevels.find(l => l.level === qualifyLevel) || null;
        const updates = { vip_level: qualifyLevel };
        if (newLvlDoc) {
          updates.transfer_remaining = newLvlDoc.perks.transfer_per_year;
          updates.buyback_remaining = newLvlDoc.perks.buyback_per_year;
          updates.skip_queue_remaining = newLvlDoc.perks.skip_queue_per_year || 0;
        } else {
          // 降到普通用户
          updates.transfer_remaining = 0;
          updates.buyback_remaining = 0;
          updates.skip_queue_remaining = 0;
        }
        await User.findByIdAndUpdate(user._id, updates);
        downgraded++;
      }
    }

    // 全员清零 annual_spend
    const updateResult = await User.updateMany({}, { annual_spend: 0 });

    await auditService.log(req.user.id, 'reset_annual_spend', 'User', null, null,
      { updated: updateResult.modifiedCount, downgraded }, req);
    logger.info('Annual spend reset', { updated: updateResult.modifiedCount, downgraded });
    return res.json({ updated: updateResult.modifiedCount, downgraded });
  } catch (err) {
    logger.error('resetAnnualSpend error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.updateVipCustomer = async (req, res) => {
  const { id } = req.params;
  const { vip_level } = req.body;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    if (Number(vip_level) >= user.vip_level) {
      return res.status(400).json({ message: '只允许手动降级，不允许升级' });
    }
    if (user.annual_spend > 0) {
      return res.status(400).json({ message: '用户本年度仍有消费记录，不允许降级' });
    }

    const before = { vip_level: user.vip_level };
    user.vip_level = Number(vip_level);
    await user.save();

    await auditService.log(req.user.id, 'update_vip_customer', 'User', user._id, before, { vip_level: user.vip_level }, req);
    return res.json({ message: 'VIP等级已更新', user });
  } catch (err) {
    logger.error('updateVipCustomer error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
