const VipLevel = require('../models/VipLevel');
const User = require('../models/User');
const logger = require('../config/logger');

async function calcVipLevel(points) {
  const level = await VipLevel.findOne({ threshold: { $lte: points }, active: true, level: { $lte: 3 } })
    .sort({ threshold: -1 })
    .lean();
  return level || null;
}

async function getPerksForLevel(level) {
  if (!level || level <= 0) {
    return {
      transfer_per_year: 0,
      buyback_per_year: 0,
      assisted_buyback_per_year: 0,
      skip_queue_per_year: 0
    };
  }
  const config = await VipLevel.findOne({ level, active: true }).lean();
  const perks = config?.perks || {};
  return {
    transfer_per_year: perks.transfer_per_year || 0,
    buyback_per_year: perks.buyback_per_year || 0,
    assisted_buyback_per_year: perks.assisted_buyback_per_year ?? perks.buyback_per_year ?? 0,
    skip_queue_per_year: perks.skip_queue_per_year || 0
  };
}

function capRemaining(current, max) {
  const currentNumber = Number(current || 0);
  const maxNumber = Number(max || 0);
  return currentNumber > maxNumber ? maxNumber : currentNumber;
}

async function syncUserVip(userId) {
  const user = await User.findById(userId);
  if (!user) return;

  const newLevel = await calcVipLevel(user.points_total);
  const newLevelNumber = newLevel?.level || 0;
  const oldLevel = user.vip_level || 0;
  const newPerks = await getPerksForLevel(newLevelNumber);
  const oldPerks = await getPerksForLevel(oldLevel);

  if (newLevelNumber > oldLevel) {
    const transferAdd = newPerks.transfer_per_year - (oldPerks.transfer_per_year || 0);
    const buybackAdd = newPerks.buyback_per_year - (oldPerks.buyback_per_year || 0);
    const assistedBuybackAdd = newPerks.assisted_buyback_per_year - (oldPerks.assisted_buyback_per_year || 0);
    const skipQueueAdd = newPerks.skip_queue_per_year - (oldPerks.skip_queue_per_year || 0);

    user.vip_level = newLevelNumber;
    if (transferAdd > 0) user.transfer_remaining += transferAdd;
    if (buybackAdd > 0) user.buyback_remaining += buybackAdd;
    if (assistedBuybackAdd > 0) user.assisted_buyback_remaining += assistedBuybackAdd;
    if (skipQueueAdd > 0) user.skip_queue_remaining += skipQueueAdd;

    if (!user.roles.includes('vip')) {
      user.roles.push('vip');
    }

    await user.save();
    logger.info('User VIP upgraded', { userId, oldLevel, newLevel: newLevelNumber });
    return user;
  }

  if (newLevelNumber < oldLevel) {
    user.vip_level = newLevelNumber;
    user.transfer_remaining = capRemaining(user.transfer_remaining, newPerks.transfer_per_year);
    user.buyback_remaining = capRemaining(user.buyback_remaining, newPerks.buyback_per_year);
    user.assisted_buyback_remaining = capRemaining(user.assisted_buyback_remaining, newPerks.assisted_buyback_per_year);
    user.skip_queue_remaining = capRemaining(user.skip_queue_remaining, newPerks.skip_queue_per_year);
    if (newLevelNumber > 0) {
      if (!user.roles.includes('vip')) user.roles.push('vip');
    } else {
      user.roles = user.roles.filter(role => role !== 'vip');
    }
    await user.save();
    logger.info('User VIP downgraded', { userId, oldLevel, newLevel: newLevelNumber });
    return user;
  }

  user.transfer_remaining = capRemaining(user.transfer_remaining, newPerks.transfer_per_year);
  user.buyback_remaining = capRemaining(user.buyback_remaining, newPerks.buyback_per_year);
  user.assisted_buyback_remaining = capRemaining(user.assisted_buyback_remaining, newPerks.assisted_buyback_per_year);
  user.skip_queue_remaining = capRemaining(user.skip_queue_remaining, newPerks.skip_queue_per_year);
  if (newLevelNumber > 0 && !user.roles.includes('vip')) user.roles.push('vip');
  if (newLevelNumber === 0) user.roles = user.roles.filter(role => role !== 'vip');
  await user.save();
  return user;
}

// Admin can manually adjust VIP level (supports both increase and decrease)
async function adjustUserVip(userId, newVipLevel) {
  const user = await User.findById(userId);
  if (!user) return null;

  const levelConfig = await VipLevel.findOne({ level: newVipLevel }).lean();
  if (!levelConfig && newVipLevel > 0) return null;

  const oldLevel = user.vip_level;
  user.vip_level = newVipLevel;

  if (newVipLevel > 0 && levelConfig) {
    user.transfer_remaining = levelConfig.perks.transfer_per_year || 0;
    user.buyback_remaining = levelConfig.perks.buyback_per_year || 0;
    user.assisted_buyback_remaining = levelConfig.perks.assisted_buyback_per_year ?? levelConfig.perks.buyback_per_year ?? 0;
    user.skip_queue_remaining = levelConfig.perks.skip_queue_per_year || 0;

    if (!user.roles.includes('vip')) {
      user.roles.push('vip');
    }
  } else {
    user.transfer_remaining = 0;
    user.buyback_remaining = 0;
    user.assisted_buyback_remaining = 0;
    user.skip_queue_remaining = 0;
    user.roles = user.roles.filter(r => r !== 'vip');
  }

  await user.save();
  logger.info('User VIP adjusted', { userId, oldLevel, newLevel: newVipLevel });
  return user;
}

async function seedVipLevels() {
  const levels = [
    { level: 1, threshold: 888, perks: { buyback_per_year: 3, assisted_buyback_per_year: 1, transfer_per_year: 0, skip_queue_per_year: 0, priority_buy: true }, active: true },
    { level: 2, threshold: 2688, perks: { buyback_per_year: 5, assisted_buyback_per_year: 5, transfer_per_year: 5, skip_queue_per_year: 0, priority_buy: true }, active: true },
    { level: 3, threshold: 5688, perks: { buyback_per_year: 8, assisted_buyback_per_year: 8, transfer_per_year: 10, skip_queue_per_year: 0, priority_buy: true }, active: true }
  ];

  for (const l of levels) {
    await VipLevel.findOneAndUpdate({ level: l.level }, l, { upsert: true, new: true });
  }
  await VipLevel.updateMany({ level: { $gt: 3 } }, { active: false });
  logger.info('VIP levels seeded');
}

module.exports = { calcVipLevel, syncUserVip, adjustUserVip, seedVipLevels, getPerksForLevel };
