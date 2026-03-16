const mongoose = require('mongoose');
const Item = require('../models/Item');
const Ownership = require('../models/Ownership');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { syncUserVip } = require('../services/vipService');
const logger = require('../config/logger');

exports.getShopItems = async (req, res) => {
  const { topic, artist, page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = { status: 'on_sale' };
    if (topic) filter.categories = topic;
    if (artist) filter.artist = new RegExp(artist, 'i');
    const total = await Item.countDocuments(filter);
    const items = await Item.find(filter)
      .select('-delivery_link')
      .sort({ created_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();
    return res.json({ total, page: pageNum, items });
  } catch (err) {
    logger.error('getShopItems error', { message: err.message });
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
    // queue_enabled 商品需要走插队通道
    if (item.queue_enabled) {
      return res.status(400).json({ message: '该商品开启了排队限购，请使用插队购买通道' });
    }
    const existing = await Ownership.findOne({ user_id: req.user.id, item_id: item._id, active: true });
    if (existing) {
      return res.status(400).json({ message: '您已拥有该素材' });
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
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Ownership.create([{
        user_id: actor._id, item_id: item._id,
        acquisition_type: 'self', points_delta: item.price,
        occurred_at: now, delivery_link: item.delivery_link, active: true
      }], { session });

      await Transaction.create([{
        type: 'purchase_self', actor_id: actor._id,
        item_id: item._id, price: item.price,
        points_change: item.price, has_delivery_link: true, occurred_at: now
      }], { session });

      actor.points_total += item.price;
      actor.annual_spend += item.price;
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

// 插队购买：VIP4/5 用消耗 skip_queue_remaining 立即购买限购商品
exports.skipQueueBuy = async (req, res) => {
  const { id } = req.params;
  try {
    const item = await Item.findById(id);
    if (!item || item.status !== 'on_sale') {
      return res.status(404).json({ message: '商品不存在或已下架' });
    }
    if (!item.queue_enabled) {
      return res.status(400).json({ message: '该商品未开启排队限购，请直接购买' });
    }

    const actor = await User.findById(req.user.id);
    if (!actor) {
      return res.status(404).json({ message: '用户不存在' });
    }
    if (actor.vip_level < 4) {
      return res.status(403).json({ message: '需要 VIP4 或以上才能使用插队购买' });
    }
    if (actor.skip_queue_remaining <= 0) {
      return res.status(400).json({ message: '本年度插队次数已用完' });
    }
    const existing = await Ownership.findOne({ user_id: req.user.id, item_id: item._id, active: true });
    if (existing) {
      return res.status(400).json({ message: '您已拥有该素材' });
    }

    const now = new Date();
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Ownership.create([{
        user_id: actor._id, item_id: item._id,
        acquisition_type: 'self', points_delta: item.price,
        occurred_at: now, delivery_link: item.delivery_link, active: true
      }], { session });

      await Transaction.create([{
        type: 'purchase_self', actor_id: actor._id,
        item_id: item._id, price: item.price,
        points_change: item.price, has_delivery_link: true,
        occurred_at: now, metadata: { skip_queue: true }
      }], { session });

      actor.points_total += item.price;
      actor.annual_spend += item.price;
      actor.skip_queue_remaining -= 1;
      await actor.save({ session });
      await session.commitTransaction();
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }

    await syncUserVip(actor._id);
    logger.info('Asset skip-queue purchased', { user: actor._id, item: item._id });
    return res.json({ message: '插队购买成功' });
  } catch (err) {
    logger.error('skipQueueBuy error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
