const mongoose = require('mongoose');
const Item = require('../models/Item');
const Ownership = require('../models/Ownership');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const VipLevel = require('../models/VipLevel');
const { syncUserVip } = require('../services/vipService');
const logger = require('../config/logger');
const { normalizeItem } = require('../utils/publicUrl');
const { selectIdentityForMaterial, buildOwnershipIdentityFields } = require('../utils/identity');
const {
  resolvePointsAndSpend,
  shouldHaveDeliveryLink
} = require('../services/authorizationRules');

function getUserDisplayId(user) {
  if (!user) return '';
  if (user.platform_id) return user.platform_id;
  const identities = user.identities || [];
  const primary = identities.find(identity => identity.is_primary && identity.status !== 'rejected')
    || identities.find(identity => identity.status === 'approved')
    || identities[0];
  return primary?.nickname || user.username || '';
}

exports.getShopItems = async (req, res) => {
  const { topic, artist, status, page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = {};
    // 允许按状态筛选(在售/结车)，不显示下架商品
    if (status && ['on_sale', 'completed'].includes(status)) {
      filter.status = status;
    } else {
      filter.status = { $in: ['on_sale', 'completed'] };
    }
    if (topic) filter.topics = topic;
    if (artist) filter.artist = new RegExp(artist, 'i');
    const total = await Item.countDocuments(filter);
    const items = await Item.find(filter)
      .select('-delivery_link')
      .sort({ created_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();
    return res.json({ total, page: pageNum, items: items.map(normalizeItem) });
  } catch (err) {
    logger.error('getShopItems error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.getVipLevels = async (req, res) => {
  try {
    const levels = await VipLevel.find({ active: true })
      .sort({ level: 1 })
      .lean();

    return res.json({
      levels: levels.map(level => ({
        id: String(level._id),
        level: level.level,
        threshold: level.threshold,
        buyback: level.perks?.buyback_per_year ?? 0,
        assistedBuyback: level.perks?.assisted_buyback_per_year ?? level.perks?.buyback_per_year ?? 0,
        transfer: level.perks?.transfer_per_year ?? 0,
        skipQueue: level.perks?.skip_queue_per_year ?? 0,
        priorityBuy: !!level.perks?.priority_buy
      }))
    });
  } catch (err) {
    logger.error('getVipLevels error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

// 自购：用户为自己购买一件商品
exports.buySelf = async (req, res) => {
  const { id } = req.params;
  try {
    const item = await Item.findById(id);
    if (!item || item.status !== 'on_sale') {
      return res.status(404).json({ message: '商品不存在或已下架' });
    }
    const actor = await User.findById(req.user.id);
    if (!actor) {
      return res.status(404).json({ message: '用户不存在' });
    }
    // priority_only 商品需要 VIP 才能购买（使用数据库最新 vip_level）
    if (item.priority_only && actor.vip_level < 1) {
      return res.status(403).json({ message: '该商品为 VIP 优先购商品，需要 VIP 资格才能购买' });
    }
    const now = new Date();
    const actorIdentityFields = buildOwnershipIdentityFields(selectIdentityForMaterial(actor, item.material_domain));
    const usageField = actorIdentityFields.identity_role || '';
    const displayId = actorIdentityFields.identity_nickname || getUserDisplayId(actor);
    const { points, annualSpend } = resolvePointsAndSpend({
      item,
      acquisitionMethod: '购买',
      usagePurpose: '自用'
    });
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Ownership.create([{
        user_id: actor._id, item_id: item._id,
        acquisition_type: 'self',
        usage_field: usageField,
        acquisition_method: '购买',
        usage_purpose: '自用',
        purchaser_user_id: actor._id,
        purchaser_display_id: displayId,
        purchaser_qq: actor.qq || '',
        actual_user_id: actor._id,
        actual_display_id: displayId,
        actual_qq: actor.qq || '',
        points_user_id: actor._id,
        points_delta: points,
        annual_spend_delta: annualSpend,
        occurred_at: now, delivery_link: item.delivery_link,
        ...actorIdentityFields,
        active: true
      }], { session });

      await Transaction.create([{
        type: 'purchase_self', actor_id: actor._id,
        item_id: item._id, price: item.price,
        points_change: points,
        annual_spend_change: annualSpend,
        has_delivery_link: shouldHaveDeliveryLink('购买', '自用'),
        occurred_at: now,
        metadata: { usage_field: usageField, acquisition_method: '购买', usage_purpose: '自用' }
      }], { session });

      actor.points_total += points;
      actor.annual_spend += annualSpend;
      await actor.save({ session });
      await session.commitTransaction();
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }

    await syncUserVip(actor._id);
    logger.info('Asset self-purchased', { user: actor._id, item: item._id });
    return res.json({ message: '购买成功' });
  } catch (err) {
    logger.error('buySelf error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

// 插队购买权益已在 2026-04-30 口径中删除。
exports.skipQueueBuy = async (req, res) => {
  return res.status(410).json({ message: '插队购买权益已下线' });
};
