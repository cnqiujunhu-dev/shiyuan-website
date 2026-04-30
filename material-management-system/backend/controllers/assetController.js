const mongoose = require('mongoose');
const Ownership = require('../models/Ownership');
const Transaction = require('../models/Transaction');
const Item = require('../models/Item');
const User = require('../models/User');
const { syncUserVip } = require('../services/vipService');
const logger = require('../config/logger');
const { normalizeItem } = require('../utils/publicUrl');
const { selectIdentityForMaterial, buildOwnershipIdentityFields } = require('../utils/identity');
const {
  getTransferPoints,
  isTransferableOwnership,
  resolvePointsAndSpend,
  shouldHaveDeliveryLink
} = require('../services/authorizationRules');
const {
  resolveUserSnapshot,
  getUserDisplayId
} = require('../services/authorizationImportService');

function buildStoredOwnershipIdentityFields(ownership) {
  if (!ownership?.identity_role && !ownership?.identity_nickname && !ownership?.identity_uid) return {};
  return {
    identity_id: ownership.identity_id,
    identity_role: ownership.identity_role,
    identity_nickname: ownership.identity_nickname,
    identity_uid: ownership.identity_uid || ''
  };
}

function getSnapshotFromUser(user, identityFields = {}) {
  return {
    userId: user?._id,
    displayId: identityFields.identity_nickname || getUserDisplayId(user),
    qq: user?.qq || ''
  };
}

function isSameUserSnapshot(actor, targetSnapshot) {
  if (!actor || !targetSnapshot) return false;
  if (targetSnapshot.user && String(targetSnapshot.user._id) === String(actor._id)) return true;
  if (targetSnapshot.qq && actor.qq && String(targetSnapshot.qq) === String(actor.qq)) return true;
  const actorDisplayId = getUserDisplayId(actor);
  return Boolean(targetSnapshot.displayId && actorDisplayId && targetSnapshot.displayId === actorDisplayId);
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
  const { ownership_id, target_id, target_qq, target_display_id } = req.body;
  try {
    const actor = await User.findById(req.user.id);
    if (!actor) return res.status(404).json({ message: '用户不存在' });

    const ownership = await Ownership.findOne({
      _id: ownership_id,
      user_id: req.user.id,
      active: true
    }).populate('item_id');
    if (!ownership) {
      return res.status(404).json({ message: '未找到可转让的素材记录' });
    }
    if (!isTransferableOwnership(ownership, actor)) {
      return res.status(400).json({ message: '仅 VIP2/VIP3 可转让购买或活动购买的自用授权，且需有剩余转让次数' });
    }

    const targetDisplayId = target_display_id || target_id;
    if (!targetDisplayId && !target_qq) {
      return res.status(400).json({ message: '请提供接转方圈名 ID 或 QQ' });
    }
    const targetSnapshot = await resolveUserSnapshot({ qq: target_qq, displayId: targetDisplayId });
    if (isSameUserSnapshot(actor, targetSnapshot)) {
      return res.status(400).json({ message: '不能转让给自己' });
    }

    const item = ownership.item_id;
    const transferPoints = getTransferPoints(ownership, item);
    const now = new Date();
    const actorIdentityFields = Object.keys(buildStoredOwnershipIdentityFields(ownership)).length
      ? buildStoredOwnershipIdentityFields(ownership)
      : buildOwnershipIdentityFields(selectIdentityForMaterial(actor, item.material_domain));
    const actorSnapshot = getSnapshotFromUser(actor, actorIdentityFields);
    const targetIdentityFields = targetSnapshot.user
      ? buildOwnershipIdentityFields(selectIdentityForMaterial(targetSnapshot.user, item.material_domain))
      : {};
    const usageField = ownership.usage_field || actorIdentityFields.identity_role || '';
    const acquisitionMethod = ownership.acquisition_method || '购买';

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Ownership.findByIdAndUpdate(ownership._id, { active: false }, { session });

      const [transferOutOwnership, receiverOwnership] = await Ownership.create([
        {
          user_id: actor._id,
          item_id: item._id,
          acquisition_type: 'transfer_out',
          usage_field: usageField,
          acquisition_method: acquisitionMethod,
          usage_purpose: '自用',
          purchaser_user_id: actor._id,
          purchaser_display_id: actorSnapshot.displayId,
          purchaser_qq: actorSnapshot.qq,
          actual_user_id: actor._id,
          actual_display_id: actorSnapshot.displayId,
          actual_qq: actorSnapshot.qq,
          points_user_id: actor._id,
          points_delta: -transferPoints,
          annual_spend_delta: 0,
          occurred_at: now,
          target_user_id: targetSnapshot.user?._id,
          source_ownership_id: ownership._id,
          ...actorIdentityFields,
          active: true
        },
        {
          user_id: targetSnapshot.user?._id,
          item_id: item._id,
          acquisition_type: 'self',
          usage_field: usageField,
          acquisition_method: acquisitionMethod,
          usage_purpose: '自用',
          actual_user_id: targetSnapshot.user?._id,
          actual_display_id: targetSnapshot.displayId,
          actual_qq: targetSnapshot.qq,
          points_user_id: targetSnapshot.user?._id,
          points_delta: transferPoints,
          annual_spend_delta: 0,
          occurred_at: now,
          delivery_link: ownership.delivery_link || item.delivery_link,
          source_user_id: actor._id,
          source_ownership_id: ownership._id,
          ...targetIdentityFields,
          active: true
        }
      ], { session });

      await Ownership.findByIdAndUpdate(
        transferOutOwnership._id,
        { replaced_by: receiverOwnership._id, related_ownership_id: receiverOwnership._id },
        { session }
      );
      await Ownership.findByIdAndUpdate(
        receiverOwnership._id,
        { related_ownership_id: transferOutOwnership._id },
        { session }
      );

      await Transaction.create([
        {
          type: 'transfer_out',
          actor_id: actor._id,
          target_id: targetSnapshot.user?._id,
          item_id: item._id,
          price: item.price,
          points_change: -transferPoints,
          annual_spend_change: 0,
          transfer_remaining_after: Math.max(0, (actor.transfer_remaining || 0) - 1),
          has_delivery_link: false,
          occurred_at: now,
          metadata: {
            usage_field: usageField,
            acquisition_method: acquisitionMethod,
            target_display_id: targetSnapshot.displayId,
            target_qq: targetSnapshot.qq,
            ownership_id: ownership._id,
            receiver_ownership_id: receiverOwnership._id
          }
        },
        {
          type: 'transfer_in',
          actor_id: targetSnapshot.user?._id,
          target_id: actor._id,
          item_id: item._id,
          price: item.price,
          points_change: transferPoints,
          annual_spend_change: 0,
          has_delivery_link: true,
          occurred_at: now,
          metadata: {
            usage_field: usageField,
            acquisition_method: acquisitionMethod,
            source_display_id: actorSnapshot.displayId,
            source_qq: actorSnapshot.qq,
            ownership_id: receiverOwnership._id
          }
        }
      ], { session });

      actor.points_total = Math.max(0, (actor.points_total || 0) - transferPoints);
      actor.transfer_remaining = Math.max(0, (actor.transfer_remaining || 0) - 1);
      await actor.save({ session });
      if (targetSnapshot.user) {
        targetSnapshot.user.points_total = (targetSnapshot.user.points_total || 0) + transferPoints;
        await targetSnapshot.user.save({ session });
      }
      await session.commitTransaction();
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }

    await syncUserVip(actor._id);
    if (targetSnapshot.user) await syncUserVip(targetSnapshot.user._id);
    logger.info('Asset transferred', { from: actor._id, to: targetSnapshot.user?._id || targetSnapshot.displayId || targetSnapshot.qq, item: item._id });
    return res.json({ message: '转让成功' });
  } catch (err) {
    logger.error('transferAsset error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.sponsorAsset = async (req, res) => {
  const { item_id, target_id, target_qq, target_display_id, acquisition_method } = req.body;
  try {
    const item = await Item.findById(item_id);
    if (!item || item.status === 'off_sale') {
      return res.status(404).json({ message: '商品不存在或已下架' });
    }

    const actor = await User.findById(req.user.id);
    if (!actor) return res.status(404).json({ message: '用户不存在' });

    const method = acquisition_method === '活动购买' ? '活动购买' : '购买';
    const hasTarget = Boolean(target_id || target_qq || target_display_id);
    const purpose = hasTarget ? '赞助确定' : '赞助待定';
    const now = new Date();
    const actorIdentityFields = buildOwnershipIdentityFields(selectIdentityForMaterial(actor, item.material_domain));
    const usageField = actorIdentityFields.identity_role || '';
    const actorSnapshot = getSnapshotFromUser(actor, actorIdentityFields);
    const targetSnapshot = hasTarget
      ? await resolveUserSnapshot({ qq: target_qq, displayId: target_display_id || target_id })
      : { user: null, displayId: '', qq: '' };
    if (hasTarget && !targetSnapshot.displayId && !targetSnapshot.qq) {
      return res.status(400).json({ message: '请提供被赞助方圈名 ID 或 QQ' });
    }
    if (hasTarget && isSameUserSnapshot(actor, targetSnapshot)) {
      return res.status(400).json({ message: '赞助对象不能是自己' });
    }

    const targetIdentityFields = targetSnapshot.user
      ? buildOwnershipIdentityFields(selectIdentityForMaterial(targetSnapshot.user, item.material_domain))
      : {};
    const { points, annualSpend } = resolvePointsAndSpend({
      item,
      acquisitionMethod: method,
      usagePurpose: purpose
    });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const [sponsorOwnership] = await Ownership.create([{
        user_id: actor._id,
        item_id: item._id,
        acquisition_type: purpose === '赞助待定' ? 'sponsor_pending' : 'sponsor',
        usage_field: usageField,
        acquisition_method: method,
        usage_purpose: purpose,
        purchaser_user_id: actor._id,
        purchaser_display_id: actorSnapshot.displayId,
        purchaser_qq: actorSnapshot.qq,
        actual_user_id: targetSnapshot.user?._id,
        actual_display_id: targetSnapshot.displayId,
        actual_qq: targetSnapshot.qq,
        points_user_id: actor._id,
        points_delta: points,
        annual_spend_delta: annualSpend,
        occurred_at: now,
        target_user_id: targetSnapshot.user?._id,
        ...actorIdentityFields,
        active: true
      }], { session });

      const transactionDocs = [{
        type: 'purchase_sponsor',
        actor_id: actor._id,
        target_id: targetSnapshot.user?._id,
        item_id: item._id,
        price: item.price,
        points_change: points,
        annual_spend_change: annualSpend,
        has_delivery_link: false,
        occurred_at: now,
        metadata: {
          usage_field: usageField,
          acquisition_method: method,
          usage_purpose: purpose,
          target_display_id: targetSnapshot.displayId,
          target_qq: targetSnapshot.qq,
          ownership_id: sponsorOwnership._id
        }
      }];

      if (hasTarget) {
        const [sponsoredOwnership] = await Ownership.create([{
          user_id: targetSnapshot.user?._id,
          item_id: item._id,
          acquisition_type: 'sponsored',
          usage_field: usageField,
          acquisition_method: '被赞助',
          usage_purpose: '自用',
          purchaser_user_id: actor._id,
          purchaser_display_id: actorSnapshot.displayId,
          purchaser_qq: actorSnapshot.qq,
          actual_user_id: targetSnapshot.user?._id,
          actual_display_id: targetSnapshot.displayId,
          actual_qq: targetSnapshot.qq,
          points_delta: 0,
          annual_spend_delta: 0,
          occurred_at: now,
          delivery_link: item.delivery_link,
          source_user_id: actor._id,
          related_ownership_id: sponsorOwnership._id,
          ...targetIdentityFields,
          active: true
        }], { session });
        await Ownership.findByIdAndUpdate(
          sponsorOwnership._id,
          { related_ownership_id: sponsoredOwnership._id },
          { session }
        );
        transactionDocs.push({
          type: 'sponsored',
          actor_id: targetSnapshot.user?._id,
          target_id: actor._id,
          item_id: item._id,
          price: item.price,
          points_change: 0,
          annual_spend_change: 0,
          has_delivery_link: true,
          occurred_at: now,
          metadata: {
            usage_field: usageField,
            acquisition_method: '被赞助',
            usage_purpose: '自用',
            source_display_id: actorSnapshot.displayId,
            source_qq: actorSnapshot.qq,
            ownership_id: sponsoredOwnership._id
          }
        });
      }

      await Transaction.create(transactionDocs, { session });

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
    logger.info('Asset sponsored', { actor: actor._id, target: targetSnapshot.user?._id || targetSnapshot.displayId || targetSnapshot.qq, item: item._id });
    return res.json({ message: hasTarget ? '赞助成功' : '赞助待定，稍后可登记接收方' });
  } catch (err) {
    logger.error('sponsorAsset error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

// Register a sponsor_pending ownership to a specific target user
exports.registerSponsor = async (req, res) => {
  const { ownership_id, target_id, target_qq, target_display_id } = req.body;
  try {
    if (!target_id && !target_qq && !target_display_id) {
      return res.status(400).json({ message: '请提供被赞助方圈名 ID 或 QQ' });
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

    const actor = await User.findById(req.user.id);
    const targetSnapshot = await resolveUserSnapshot({ qq: target_qq, displayId: target_display_id || target_id });
    if (!targetSnapshot.displayId && !targetSnapshot.qq) {
      return res.status(400).json({ message: '请提供被赞助方圈名 ID 或 QQ' });
    }
    if (isSameUserSnapshot(actor, targetSnapshot)) {
      return res.status(400).json({ message: '赞助对象不能是自己' });
    }

    const item = ownership.item_id;
    const targetIdentityFields = targetSnapshot.user
      ? buildOwnershipIdentityFields(selectIdentityForMaterial(targetSnapshot.user, item.material_domain))
      : {};
    const now = new Date();
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      await Ownership.findByIdAndUpdate(ownership._id, {
        acquisition_type: 'sponsor',
        usage_purpose: '赞助确定',
        actual_user_id: targetSnapshot.user?._id,
        actual_display_id: targetSnapshot.displayId,
        actual_qq: targetSnapshot.qq,
        target_user_id: targetSnapshot.user?._id
      }, { session });

      const [sponsoredOwnership] = await Ownership.create([{
        user_id: targetSnapshot.user?._id,
        item_id: item._id,
        acquisition_type: 'sponsored',
        usage_field: ownership.usage_field || ownership.identity_role || '',
        acquisition_method: '被赞助',
        usage_purpose: '自用',
        purchaser_user_id: ownership.purchaser_user_id || actor?._id,
        purchaser_display_id: ownership.purchaser_display_id || getUserDisplayId(actor),
        purchaser_qq: ownership.purchaser_qq || actor?.qq || '',
        actual_user_id: targetSnapshot.user?._id,
        actual_display_id: targetSnapshot.displayId,
        actual_qq: targetSnapshot.qq,
        points_delta: 0,
        annual_spend_delta: 0,
        occurred_at: now,
        delivery_link: item.delivery_link,
        source_user_id: req.user.id,
        related_ownership_id: ownership._id,
        ...targetIdentityFields,
        active: true
      }], { session });

      await Ownership.findByIdAndUpdate(
        ownership._id,
        { related_ownership_id: sponsoredOwnership._id },
        { session }
      );

      await Transaction.create([{
        type: 'sponsored',
        actor_id: targetSnapshot.user?._id,
        target_id: mongoose.Types.ObjectId.createFromHexString(req.user.id),
        item_id: item._id,
        price: item.price,
        points_change: 0,
        annual_spend_change: 0,
        has_delivery_link: true,
        occurred_at: now,
        metadata: {
          usage_field: sponsoredOwnership.usage_field,
          acquisition_method: '被赞助',
          usage_purpose: '自用',
          target_display_id: targetSnapshot.displayId,
          target_qq: targetSnapshot.qq,
          ownership_id: sponsoredOwnership._id
        }
      }], { session });

      await session.commitTransaction();
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }

    logger.info('Sponsor registered', { actor: req.user.id, target: targetSnapshot.user?._id || targetSnapshot.displayId || targetSnapshot.qq, item: item._id });
    return res.json({ message: '登记成功' });
  } catch (err) {
    logger.error('registerSponsor error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
