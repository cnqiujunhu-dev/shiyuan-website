const User = require('../../models/User');
const VipLevel = require('../../models/VipLevel');
const auditService = require('../../services/auditService');
const logger = require('../../config/logger');

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeVipLevelPayload(payload = {}) {
  const next = {};
  if (payload.level !== undefined) next.level = Number(payload.level);
  if (payload.threshold !== undefined || payload.points_threshold !== undefined) {
    next.threshold = Number(payload.threshold ?? payload.points_threshold);
  }
  if (payload.active !== undefined) next.active = !!payload.active;

  const rawPerks = payload.perks && typeof payload.perks === 'object' ? payload.perks : {};
  const perkUpdates = {};

  if (
    rawPerks.buyback_per_year !== undefined ||
    payload.buyback_per_year !== undefined ||
    payload.repurchase_per_year !== undefined
  ) {
    perkUpdates.buyback_per_year = Number(
      rawPerks.buyback_per_year ?? payload.buyback_per_year ?? payload.repurchase_per_year
    );
  }

  if (
    rawPerks.assisted_buyback_per_year !== undefined ||
    payload.assisted_buyback_per_year !== undefined ||
    payload.assisted_repurchase_per_year !== undefined
  ) {
    perkUpdates.assisted_buyback_per_year = Number(
      rawPerks.assisted_buyback_per_year ?? payload.assisted_buyback_per_year ?? payload.assisted_repurchase_per_year
    );
  }

  if (rawPerks.transfer_per_year !== undefined || payload.transfer_per_year !== undefined) {
    perkUpdates.transfer_per_year = Number(rawPerks.transfer_per_year ?? payload.transfer_per_year);
  }

  if (
    rawPerks.skip_queue_per_year !== undefined ||
    payload.skip_queue_per_year !== undefined ||
    payload.free_grab_per_year !== undefined
  ) {
    perkUpdates.skip_queue_per_year = Number(
      rawPerks.skip_queue_per_year ?? payload.skip_queue_per_year ?? payload.free_grab_per_year
    );
  }

  if (
    rawPerks.priority_buy !== undefined ||
    payload.priority_buy !== undefined ||
    payload.vip_priority !== undefined
  ) {
    perkUpdates.priority_buy = !!(
      rawPerks.priority_buy ?? payload.priority_buy ?? payload.vip_priority
    );
  }

  if (Object.keys(perkUpdates).length > 0) {
    next.perks = perkUpdates;
  }

  return next;
}

function serializeVipLevel(levelDoc) {
  const level = levelDoc.toObject ? levelDoc.toObject() : levelDoc;
  const perks = level.perks || {};

  return {
    ...level,
    id: String(level._id),
    points_threshold: level.threshold,
    repurchase_per_year: perks.buyback_per_year ?? 0,
    buyback_per_year: perks.buyback_per_year ?? 0,
    assisted_buyback_per_year: perks.assisted_buyback_per_year ?? perks.buyback_per_year ?? 0,
    transfer_per_year: perks.transfer_per_year ?? 0,
    free_grab_per_year: perks.skip_queue_per_year ?? 0,
    skip_queue_per_year: perks.skip_queue_per_year ?? 0,
    vip_priority: !!perks.priority_buy,
    priority_buy: !!perks.priority_buy
  };
}

async function findVipLevelByIdentifier(identifier) {
  const raw = String(identifier || '').trim();
  if (!raw) return null;

  let vipLevel = null;
  if (/^\d+$/.test(raw)) {
    vipLevel = await VipLevel.findOne({ level: Number(raw) });
  }
  if (!vipLevel) {
    vipLevel = await VipLevel.findById(raw);
  }
  return vipLevel;
}

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
  const records = Array.isArray(req.body) ? req.body : req.body?.vips;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ message: '请提供有效的VIP记录数组' });
  }

  let imported = 0;
  const failed = [];

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    try {
      const user = await findOrCreateUserByEmailOrQq(rec.email, rec.qq);
      const vipLevel = Number(rec.vip_level) || 0;
      if (vipLevel > 3) {
        throw new Error('VIP 等级只支持 0、1、2、3');
      }
      const vipLevelDoc = vipLevel > 0 ? await VipLevel.findOne({ level: vipLevel }) : null;

      if (vipLevel > 0 && !vipLevelDoc) {
        throw new Error(`VIP${vipLevel} 等级配置不存在`);
      }

      user.vip_level = vipLevel;
      if (rec.points !== undefined) user.points_total = Number(rec.points) || 0;
      if (rec.annual_spend !== undefined) user.annual_spend = Number(rec.annual_spend) || 0;
      if (rec.platform !== undefined) user.platform = rec.platform || undefined;
      if (rec.platform_id !== undefined) user.platform_id = rec.platform_id || undefined;

      if (vipLevelDoc) {
        user.transfer_remaining = vipLevelDoc.perks.transfer_per_year;
        user.buyback_remaining = vipLevelDoc.perks.buyback_per_year;
        user.assisted_buyback_remaining = vipLevelDoc.perks.assisted_buyback_per_year ?? vipLevelDoc.perks.buyback_per_year ?? 0;
        user.skip_queue_remaining = vipLevelDoc.perks.skip_queue_per_year || 0;
        if (!user.roles.includes('vip')) user.roles.push('vip');
      } else {
        user.transfer_remaining = 0;
        user.buyback_remaining = 0;
        user.assisted_buyback_remaining = 0;
        user.skip_queue_remaining = 0;
        user.roles = user.roles.filter(role => role !== 'vip');
      }

      await user.save();
      imported++;
    } catch (err) {
      failed.push({ index: i, record: rec, error: err.message });
    }
  }

  logger.info('VIPs imported', { imported, failed: failed.length });
  return res.json({
    message: `成功导入 ${imported} 条，失败 ${failed.length} 条`,
    success: imported,
    imported,
    failed: failed.length,
    errors: failed
  });
};

exports.getLevels = async (req, res) => {
  try {
    const levels = await VipLevel.find({ level: { $lte: 3 } }).sort({ level: 1 }).lean();
    return res.json({ levels: levels.map(serializeVipLevel) });
  } catch (err) {
    logger.error('getLevels error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.createLevel = async (req, res) => {
  try {
    const payload = normalizeVipLevelPayload(req.body);
    if (!Number.isFinite(payload.level) || payload.level <= 0 || payload.level > 3) {
      return res.status(400).json({ message: 'VIP 等级只支持 1、2、3' });
    }
    if (!Number.isFinite(payload.threshold) || payload.threshold < 0) {
      return res.status(400).json({ message: '请提供有效的积分门槛' });
    }

    const existing = await VipLevel.findOne({ level: payload.level });
    if (existing) {
      return res.status(409).json({ message: '该等级已存在' });
    }

    const vipLevel = await VipLevel.create({
      level: payload.level,
      threshold: payload.threshold,
      active: payload.active ?? true,
      perks: {
        buyback_per_year: payload.perks?.buyback_per_year ?? 0,
        assisted_buyback_per_year: payload.perks?.assisted_buyback_per_year ?? payload.perks?.buyback_per_year ?? 0,
        transfer_per_year: payload.perks?.transfer_per_year ?? 0,
        skip_queue_per_year: payload.perks?.skip_queue_per_year ?? 0,
        priority_buy: payload.perks?.priority_buy ?? false
      }
    });

    return res.status(201).json({ message: '等级创建成功', vipLevel: serializeVipLevel(vipLevel) });
  } catch (err) {
    logger.error('createLevel error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.updateLevel = async (req, res) => {
  const { id } = req.params;
  try {
    const vipLevel = await findVipLevelByIdentifier(id);
    if (!vipLevel) {
      return res.status(404).json({ message: 'VIP等级不存在' });
    }
    if (vipLevel.level > 3) {
      return res.status(400).json({ message: 'VIP4/VIP5 已下线，不支持修改' });
    }

    const payload = normalizeVipLevelPayload(req.body);
    if (payload.threshold !== undefined) {
      if (!Number.isFinite(payload.threshold) || payload.threshold < 0) {
        return res.status(400).json({ message: '请提供有效的积分门槛' });
      }
      vipLevel.threshold = payload.threshold;
    }
    if (payload.active !== undefined) vipLevel.active = payload.active;
    if (payload.perks) {
      vipLevel.perks = {
        ...vipLevel.perks.toObject(),
        ...payload.perks
      };
    }

    await vipLevel.save();
    return res.json({ message: '等级已更新', vipLevel: serializeVipLevel(vipLevel) });
  } catch (err) {
    logger.error('updateLevel error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.getVipCustomers = async (req, res) => {
  const { q, vip_level, page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = { vip_level: { $gte: 1 } };
    if (vip_level) filter.vip_level = Number(vip_level);
    if (q) {
      const re = new RegExp(escapeRegExp(q), 'i');
      filter.$or = [{ username: re }, { qq: re }, { platform_id: re }, { email: re }];
    }
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('username platform platform_id qq vip_level points_total annual_spend transfer_remaining buyback_remaining assisted_buyback_remaining')
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
      if (Number(vip_level) > 3) {
        return res.status(400).json({ message: 'VIP 等级只支持 1、2、3' });
      }
      const lvl = await VipLevel.findOne({ level: Number(vip_level) });
      if (lvl) levelsToReset = [lvl];
    } else {
      levelsToReset = await VipLevel.find({ active: true, level: { $lte: 3 } });
    }

    let updated = 0;
    for (const lvl of levelsToReset) {
      const result = await User.updateMany(
        { vip_level: lvl.level },
        {
          transfer_remaining: lvl.perks.transfer_per_year,
          buyback_remaining: lvl.perks.buyback_per_year,
          assisted_buyback_remaining: lvl.perks.assisted_buyback_per_year ?? lvl.perks.buyback_per_year ?? 0,
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
    // Annual spend reset only clears the yearly spend ledger.
    // VIP downgrade is intentionally handled by updateVipCustomer after manual review.
    const updateResult = await User.updateMany(
      { annual_spend: { $ne: 0 } },
      { annual_spend: 0 }
    );
    const updated = updateResult.modifiedCount || 0;

    await auditService.log(req.user.id, 'reset_annual_spend', 'User', null, null,
      { updated, downgraded: 0 }, req);
    logger.info('Annual spend reset', { updated, downgraded: 0 });
    return res.json({ updated, downgraded: 0 });
  } catch (err) {
    logger.error('resetAnnualSpend error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.updateVipCustomer = async (req, res) => {
  const { id } = req.params;
  const {
    vip_level,
    points_total,
    transfer_remaining,
    buyback_remaining,
    assisted_buyback_remaining,
    skip_queue_remaining
  } = req.body;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const before = {
      vip_level: user.vip_level,
      points_total: user.points_total,
      transfer_remaining: user.transfer_remaining,
      buyback_remaining: user.buyback_remaining,
      assisted_buyback_remaining: user.assisted_buyback_remaining,
      skip_queue_remaining: user.skip_queue_remaining
    };

    if (vip_level !== undefined && Number(vip_level) !== user.vip_level) {
      const nextLevel = Number(vip_level);
      if (nextLevel > 3) {
        return res.status(400).json({ message: 'VIP 等级只支持 0、1、2、3' });
      }
      if (nextLevel > user.vip_level) {
        return res.status(400).json({ message: '只允许手动降级，不允许升级' });
      }
      if (user.annual_spend > 0) {
        return res.status(400).json({ message: '用户本年度仍有消费记录，不允许降级' });
      }

      if (nextLevel > 0) {
        const vipLevelDoc = await VipLevel.findOne({ level: nextLevel }).lean();
        if (!vipLevelDoc) {
          return res.status(404).json({ message: `VIP${nextLevel} 等级配置不存在` });
        }
        user.vip_level = nextLevel;
        if (!user.roles.includes('vip')) user.roles.push('vip');
        user.transfer_remaining = vipLevelDoc.perks.transfer_per_year;
        user.buyback_remaining = vipLevelDoc.perks.buyback_per_year;
        user.assisted_buyback_remaining = vipLevelDoc.perks.assisted_buyback_per_year ?? vipLevelDoc.perks.buyback_per_year ?? 0;
        user.skip_queue_remaining = vipLevelDoc.perks.skip_queue_per_year || 0;
      } else {
        user.vip_level = 0;
        user.transfer_remaining = 0;
        user.buyback_remaining = 0;
        user.assisted_buyback_remaining = 0;
        user.skip_queue_remaining = 0;
        user.roles = user.roles.filter(role => role !== 'vip');
      }
    }

    if (points_total !== undefined) user.points_total = Number(points_total) || 0;
    if (transfer_remaining !== undefined) user.transfer_remaining = Number(transfer_remaining) || 0;
    if (buyback_remaining !== undefined) user.buyback_remaining = Number(buyback_remaining) || 0;
    if (assisted_buyback_remaining !== undefined) user.assisted_buyback_remaining = Number(assisted_buyback_remaining) || 0;
    if (skip_queue_remaining !== undefined) user.skip_queue_remaining = Number(skip_queue_remaining) || 0;

    await user.save();

    await auditService.log(req.user.id, 'update_vip_customer', 'User', user._id, before, {
      vip_level: user.vip_level,
      points_total: user.points_total,
      transfer_remaining: user.transfer_remaining,
      buyback_remaining: user.buyback_remaining,
      assisted_buyback_remaining: user.assisted_buyback_remaining,
      skip_queue_remaining: user.skip_queue_remaining
    }, req);
    return res.json({ message: 'VIP等级已更新', user });
  } catch (err) {
    logger.error('updateVipCustomer error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
