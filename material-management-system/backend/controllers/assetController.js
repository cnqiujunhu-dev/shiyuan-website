const mongoose = require('mongoose');
const Ownership = require('../models/Ownership');
const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const User = require('../models/User');
const { syncUserVip } = require('../services/vipService');
const logger = require('../config/logger');

exports.getMyAssets = async (req, res) => {
  const { topic, artist, type, page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = { user_id: req.user.id, active: true };
    if (type) filter.acquisition_type = type;

    const allOwns = await Ownership.find(filter)
      .populate('item_id', 'name artist categories price preview_url')
      .lean();

    let filtered = allOwns;
    if (topic) {
      filtered = filtered.filter(
        (o) => o.item_id && o.item_id.categories && o.item_id.categories.includes(topic)
      );
    }
    if (artist) {
      const re = new RegExp(artist, 'i');
      filtered = filtered.filter((o) => o.item_id && re.test(o.item_id.artist));
    }

    const total = filtered.length;
    const paginated = filtered
      .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
      .slice((pageNum - 1) * limitNum, pageNum * limitNum)
      .map((o) => {
        const obj = { ...o };
        if (o.acquisition_type === 'transfer_out') obj.delivery_link = null;
        return obj;
      });

    return res.json({ total, page: pageNum, ownerships: paginated });
  } catch (err) {
    logger.error('getMyAssets error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.transferAsset = async (req, res) => {
  const { ownership_id, target_platform, target_id, target_qq } = req.body;
  try {
    if (!req.user.roles.includes('vip') && req.user.vip_level < 2) {
      return res.status(403).json({ message: '需要 VIP 等级 2 或以上才能转让' });
    }
    const actor = await User.findById(req.user.id);
    if (!actor || actor.transfer_remaining <= 0) {
      return res.status(400).json({ message: '本年度转让次数已用完' });
    }
    const ownership = await Ownership.findOne({
      _id: ownership_id,
      user_id: req.user.id,
      acquisition_type: 'self',
      active: true
    }).populate('item_id');
    if (!ownership) {
      return res.status(404).json({ message: '未找到可转让的素材记录' });
    }
    const item = ownership.item_id;

    let targetQuery;
    if (target_platform && target_id && target_qq) {
      targetQuery = { $or: [{ platform: target_platform, platform_id: target_id }, { qq: target_qq }] };
    } else if (target_platform && target_id) {
      targetQuery = { platform: target_platform, platform_id: target_id };
    } else if (target_qq) {
      targetQuery = { qq: target_qq };
    } else {
      return res.status(400).json({ message: '请提供接转方信息' });
    }

    const targetUser = await User.findOne(targetQuery);
    if (!targetUser) {
      return res.status(404).json({ message: '接转方用户未注册，请让对方先注册账号' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const now = new Date();
      const [transferInOwnership] = await Ownership.create([{
        user_id: targetUser._id,
        item_id: item._id,
        acquisition_type: 'transfer_in',
        points_delta: item.price,
        occurred_at: now,
        delivery_link: item.delivery_link,
        source_user_id: actor._id,
        active: true
      }], { session });

      await Ownership.findByIdAndUpdate(ownership._id, { active: false }, { session });

      await Ownership.create([{
        user_id: actor._id,
        item_id: item._id,
        acquisition_type: 'transfer_out',
        points_delta: 0,
        occurred_at: now,
        source_user_id: targetUser._id,
        replaced_by: transferInOwnership._id,
        active: true
      }], { session });

      await Transaction.create([
        {
          type: 'transfer_out',
          actor_id: actor._id,
          target_id: targetUser._id,
          item_id: item._id,
          price: item.price,
          points_change: 0,
          has_delivery_link: false,
          occurred_at: now
        },
        {
          type: 'transfer_in',
          actor_id: targetUser._id,
          target_id: actor._id,
          item_id: item._id,
          price: item.price,
          points_change: item.price,
          has_delivery_link: true,
          occurred_at: now
        }
      ], { session });

      actor.transfer_remaining -= 1;
      await actor.save({ session });
      targetUser.points_total += item.price;
      await targetUser.save({ session });
      await session.commitTransaction();
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }

    await syncUserVip(targetUser._id);
    logger.info('Asset transferred', { from: actor._id, to: targetUser._id, item: item._id });
    return res.json({ message: '转让成功' });
  } catch (err) {
    logger.error('transferAsset error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.sponsorAsset = async (req, res) => {
  const { item_id, target_platform, target_id, target_qq } = req.body;
  try {
    const item = await Item.findById(item_id);
    if (!item || item.status !== 'on_sale') {
      return res.status(404).json({ message: '商品不存在或已下架' });
    }

    let targetQuery;
    if (target_platform && target_id && target_qq) {
      targetQuery = { $or: [{ platform: target_platform, platform_id: target_id }, { qq: target_qq }] };
    } else if (target_platform && target_id) {
      targetQuery = { platform: target_platform, platform_id: target_id };
    } else if (target_qq) {
      targetQuery = { qq: target_qq };
    } else {
      return res.status(400).json({ message: '请提供赞助对象信息' });
    }

    const targetUser = await User.findOne(targetQuery);
    if (!targetUser) {
      return res.status(404).json({ message: '赞助对象未注册' });
    }

    const existingOwnership = await Ownership.findOne({
      user_id: targetUser._id,
      item_id: item._id,
      active: true
    });
    if (existingOwnership) {
      return res.status(400).json({ message: '对方已拥有该素材' });
    }

    const actor = await User.findById(req.user.id);
    const now = new Date();
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Ownership.create([
        {
          user_id: actor._id,
          item_id: item._id,
          acquisition_type: 'self',
          points_delta: item.price,
          occurred_at: now,
          active: true
        },
        {
          user_id: targetUser._id,
          item_id: item._id,
          acquisition_type: 'sponsored',
          points_delta: 0,
          occurred_at: now,
          delivery_link: item.delivery_link,
          source_user_id: actor._id,
          active: true
        }
      ], { session });

      await Transaction.create([
        {
          type: 'purchase_sponsor',
          actor_id: actor._id,
          target_id: targetUser._id,
          item_id: item._id,
          price: item.price,
          points_change: item.price,
          has_delivery_link: false,
          occurred_at: now
        },
        {
          type: 'sponsored',
          actor_id: targetUser._id,
          target_id: actor._id,
          item_id: item._id,
          price: item.price,
          points_change: 0,
          has_delivery_link: true,
          occurred_at: now
        }
      ], { session });

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
    logger.info('Asset sponsored', { actor: actor._id, target: targetUser._id, item: item._id });
    return res.json({ message: '赞助成功' });
  } catch (err) {
    logger.error('sponsorAsset error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
