const VipLevel = require('../models/VipLevel');
const User = require('../models/User');
const logger = require('../config/logger');

async function calcVipLevel(points) {
  const level = await VipLevel.findOne({ threshold: { $lte: points }, active: true })
    .sort({ threshold: -1 })
    .lean();
  return level || null;
}

async function syncUserVip(userId) {
  const user = await User.findById(userId);
  if (!user) return;

  const newLevel = await calcVipLevel(user.points_total);
  if (!newLevel) return;

  if (newLevel.level > user.vip_level) {
    const oldLevel = user.vip_level;
    const transferAdd = newLevel.perks.transfer_per_year - (oldLevel > 0 ? (await VipLevel.findOne({ level: oldLevel }).lean())?.perks?.transfer_per_year || 0 : 0);
    const buybackAdd = newLevel.perks.buyback_per_year - (oldLevel > 0 ? (await VipLevel.findOne({ level: oldLevel }).lean())?.perks?.buyback_per_year || 0 : 0);

    user.vip_level = newLevel.level;
    if (transferAdd > 0) user.transfer_remaining += transferAdd;
    if (buybackAdd > 0) user.buyback_remaining += buybackAdd;

    if (!user.roles.includes('vip')) {
      user.roles.push('vip');
    }

    await user.save();
    logger.info('User VIP upgraded', { userId, oldLevel, newLevel: newLevel.level });
  }
}

async function seedVipLevels() {
  // 门槛与权益严格按 PRD V2.0 定义
  const levels = [
    { level: 1, threshold: 888,   perks: { buyback_per_year: 1, transfer_per_year: 0, skip_queue_per_year: 0, priority_buy: true } },
    { level: 2, threshold: 2688,  perks: { buyback_per_year: 1, transfer_per_year: 1, skip_queue_per_year: 0, priority_buy: true } },
    { level: 3, threshold: 5688,  perks: { buyback_per_year: 2, transfer_per_year: 2, skip_queue_per_year: 0, priority_buy: true } },
    { level: 4, threshold: 8888,  perks: { buyback_per_year: 2, transfer_per_year: 3, skip_queue_per_year: 3, priority_buy: true } },
    { level: 5, threshold: 16888, perks: { buyback_per_year: 3, transfer_per_year: 6, skip_queue_per_year: 6, priority_buy: true } }
  ];

  for (const l of levels) {
    await VipLevel.findOneAndUpdate({ level: l.level }, l, { upsert: true, new: true });
  }
  logger.info('VIP levels seeded');
}

module.exports = { calcVipLevel, syncUserVip, seedVipLevels };
