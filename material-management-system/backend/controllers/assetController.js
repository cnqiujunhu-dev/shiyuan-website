const mongoose = require('mongoose');
const Ownership = require('../models/Ownership');
const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const User = require('../models/User');
const { syncUserVip } = require('../services/vipService');
const logger = require('../config/logger');
const { normalizeItem } = require('../utils/publicUrl');
const { selectIdentityForMaterial, buildOwnershipIdentityFields } = require('../utils/identity');

function buildStoredOwnershipIdentityFields(ownership) {
  if (!ownership?.identity_role && !ownership?.identity_nickname && !ownership?.identity_uid) return {};
  return {
    identity_id: ownership.identity_id,
    identity_role: ownership.identity_role,
    identity_nickname: ownership.identity_nickname,
    identity_uid: ownership.identity_uid || ''
  };
}

exports.getMyAssets = async (req, res) => {
  const { topic, artist, acquisition_type, page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = { user_id: req.user.id, active: true };

    // Hide legacy transfer_out records from user view
    if (!acquisition_type) {
      filter.acquisition_type = { $nin: ['transfer_out'] };
    } else {
      filter.acquisition_type = acquisition_type;
    }

    const allOwns = await Ownership.find(filter)
      .populate('item_id', 'name artist categories topics price preview_url sku_code status delivery_link')
      .populate('source_user_id', 'username qq platform platform_id')
      .populate('target_user_id', 'username qq platform platform_id')
      .lean();

    let filtered = allOwns;
    if (topic) {
      filtered = filtered.filter(
        (o) => o.item_id && (
          (o.item_id.topics && o.item_id.topics.includes(topic)) ||
          (o.item_id.categories && o.item_id.categories.includes(topic))
        )
      );
    }
    if (artist) {
      const re = new RegExp(artist, 'i');
      filtered = filtered.filter((o) => o.item_id && re.test(o.item_id.artist));
    }

    const total = filtered.length;
    const paginated = filtered
      .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))
      .slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return res.json({
      total,
      page: pageNum,
      ownerships: paginated.map(ownership => ({
        ...ownership,
        item_id: normalizeItem(ownership.item_id)
      }))
    });
  } catch (err) {
    logger.error('getMyAssets error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.transferAsset = async (req, res) => {
  const { ownership_id, target_id, target_qq } = req.body;
  try {
    const actor = await User.findById(req.user.id);
    if (!actor) {
      return res.status(404).json({ message: '用户不存在' });
    }
    if (actor.vip_level < 2) {
      return res.status(403).json({ message: '您的转让次数不足，无法转让' });
    }
    if (actor.transfer_remaining <= 0) {
      return res.status(400).json({ message: '您的转让次数不足，无法转让' });
    }
    const ownership = await Ownership.findOne({
      _id: ownership_id,
      user_id: req.user.id,
      acquisition_type: { $in: ['self', 'transfer_in'] },
      transfer_locked: { $ne: true },
      active: true
    }).populate('item_id');
    if (!ownership) {
      const lockedOwnership = await Ownership.findOne({
        _id: ownership_id,
        user_id: req.user.id,
        acquisition_type: { $in: ['self', 'transfer_in'] },
        transfer_locked: true,
        active: true
      }).lean();
      if (lockedOwnership) {
        return res.status(400).json({ message: '该素材不可转让' });
      }
      return res.status(404).json({ message: '未找到可转让的素材记录' });
    }
    const item = ownership.item_id;

    // Find target user by ID or QQ
    let targetQuery;
    if (target_id && target_qq) {
      targetQuery = { $or: [{ _id: target_id }, { qq: target_qq }] };
    } else if (target_id) {
      targetQuery = { _id: target_id };
    } else if (target_qq) {
      targetQuery = { qq: target_qq };
    } else {
      return res.status(400).json({ message: '请提供接转方的 ID 或 QQ' });
    }

    const targetUser = await User.findOne(targetQuery);
    if (!targetUser) {
      return res.status(404).json({ message: '接转方用户未注册，请让对方先注册账号' });
    }
    if (String(targetUser._id) === String(actor._id)) {
      return res.status(400).json({ message: '不能转让给自己' });
    }
    const existingOwnership = await Ownership.findOne({
      user_id: targetUser._id,
      item_id: item._id,
      acquisition_type: { $ne: 'transfer_out' },
      active: true
    });
    if (existingOwnership) {
      return res.status(400).json({ message: '接转方已拥有该素材' });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const now = new Date();
      const actorIdentityFields = Object.keys(buildStoredOwnershipIdentityFields(ownership)).length
        ? buildStoredOwnershipIdentityFields(ownership)
        : buildOwnershipIdentityFields(selectIdentityForMaterial(actor, item.material_domain));
      const targetIdentityFields = buildOwnershipIdentityFields(selectIdentityForMaterial(targetUser, item.material_domain));

      // Deactivate the original self ownership while keeping it for rollback recovery.
      await Ownership.findByIdAndUpdate(ownership._id, { active: false }, { session });

      const [transferOutOwnership, receiverOwnership] = await Ownership.create([
        {
          user_id: actor._id,
          item_id: item._id,
          acquisition_type: 'transfer_out',
          points_delta: 0,
          occurred_at: now,
          target_user_id: targetUser._id,
          ...actorIdentityFields,
          active: true
        },
        {
          user_id: targetUser._id,
          item_id: item._id,
          acquisition_type: 'self',
          points_delta: 0,
          occurred_at: now,
          delivery_link: ownership.delivery_link || item.delivery_link,
          source_user_id: actor._id,
          ...targetIdentityFields,
          active: true
        }
      ], { session });

      await Ownership.findByIdAndUpdate(
        transferOutOwnership._id,
        { replaced_by: receiverOwnership._id },
        { session }
      );

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
          points_change: 0,
          has_delivery_link: true,
          occurred_at: now
        }
      ], { session });

      actor.transfer_remaining -= 1;
      await actor.save({ session });
      await session.commitTransaction();
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }

    logger.info('Asset transferred', { from: actor._id, to: targetUser._id, item: item._id });
    return res.json({ message: '转让成功' });
  } catch (err) {
    logger.error('transferAsset error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.sponsorAsset = async (req, res) => {
  const { item_id, target_id, target_qq } = req.body;
  try {
    const item = await Item.findById(item_id);
    if (!item || item.status === 'off_sale') {
      return res.status(404).json({ message: '商品不存在或已下架' });
    }

    const actor = await User.findById(req.user.id);
    if (!actor) {
      return res.status(404).json({ message: '用户不存在' });
    }
    const now = new Date();
    const actorIdentityFields = buildOwnershipIdentityFields(selectIdentityForMaterial(actor, item.material_domain));

    // If no target specified, create sponsor_pending
    if (!target_id && !target_qq) {
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        await Ownership.create([{
          user_id: actor._id,
          item_id: item._id,
          acquisition_type: 'sponsor_pending',
          points_delta: item.price,
          occurred_at: now,
          ...actorIdentityFields,
          active: true
        }], { session });

        await Transaction.create([{
          type: 'purchase_sponsor',
          actor_id: actor._id,
          item_id: item._id,
          price: item.price,
          points_change: item.price,
          has_delivery_link: false,
          occurred_at: now
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
      return res.json({ message: '赞助待定，稍后可登记接收方' });
    }

    // Find target user
    let targetQuery;
    if (target_id && target_qq) {
      targetQuery = { $or: [{ _id: target_id }, { qq: target_qq }] };
    } else if (target_id) {
      targetQuery = { _id: target_id };
    } else {
      targetQuery = { qq: target_qq };
    }

    const targetUser = await User.findOne(targetQuery);
    if (!targetUser) {
      return res.status(404).json({ message: '赞助对象未注册' });
    }

    const existingOwnership = await Ownership.findOne({
      user_id: targetUser._id,
      item_id: item._id,
      acquisition_type: { $ne: 'transfer_out' },
      active: true
    });
    if (existingOwnership) {
      return res.status(400).json({ message: '对方已拥有该素材' });
    }
    const targetIdentityFields = buildOwnershipIdentityFields(selectIdentityForMaterial(targetUser, item.material_domain));

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Ownership.create([
        {
          user_id: actor._id,
          item_id: item._id,
          acquisition_type: 'sponsor',
          points_delta: item.price,
          occurred_at: now,
          target_user_id: targetUser._id,
          ...actorIdentityFields,
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
          ...targetIdentityFields,
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

// Register a sponsor_pending ownership to a specific target user
exports.registerSponsor = async (req, res) => {
  const { ownership_id, target_id, target_qq } = req.body;
  try {
    if (!target_id && !target_qq) {
      return res.status(400).json({ message: '请提供被赞助方的 ID 或 QQ' });
    }

    const ownership = await Ownership.findOne({
      _id: ownership_id,
      user_id: req.user.id,
      acquisition_type: 'sponsor_pending',
      active: true
    }).populate('item_id');
    if (!ownership) {
      return res.status(404).json({ message: '未找到待登记的赞助记录' });
    }

    let targetQuery;
    if (target_id && target_qq) {
      targetQuery = { $or: [{ _id: target_id }, { qq: target_qq }] };
    } else if (target_id) {
      targetQuery = { _id: target_id };
    } else {
      targetQuery = { qq: target_qq };
    }

    const targetUser = await User.findOne(targetQuery);
    if (!targetUser) {
      return res.status(404).json({ message: '被赞助方用户未注册' });
    }

    const item = ownership.item_id;
    const existingOwnership = await Ownership.findOne({
      user_id: targetUser._id,
      item_id: item._id,
      acquisition_type: { $ne: 'transfer_out' },
      active: true
    });
    if (existingOwnership) {
      return res.status(400).json({ message: '被赞助方已拥有该素材' });
    }
    const targetIdentityFields = buildOwnershipIdentityFields(selectIdentityForMaterial(targetUser, item.material_domain));
    const now = new Date();
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Change sponsor_pending to sponsor
      await Ownership.findByIdAndUpdate(ownership._id, {
        acquisition_type: 'sponsor',
        target_user_id: targetUser._id
      }, { session });

      // Create sponsored ownership for target
      await Ownership.create([{
        user_id: targetUser._id,
        item_id: item._id,
        acquisition_type: 'sponsored',
        points_delta: 0,
        occurred_at: now,
        delivery_link: item.delivery_link,
        source_user_id: req.user.id,
        ...targetIdentityFields,
        active: true
      }], { session });

      await Transaction.create([{
        type: 'sponsored',
        actor_id: targetUser._id,
        target_id: mongoose.Types.ObjectId.createFromHexString(req.user.id),
        item_id: item._id,
        price: item.price,
        points_change: 0,
        has_delivery_link: true,
        occurred_at: now
      }], { session });

      await session.commitTransaction();
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }

    logger.info('Sponsor registered', { actor: req.user.id, target: targetUser._id, item: item._id });
    return res.json({ message: '登记成功' });
  } catch (err) {
    logger.error('registerSponsor error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
