const mongoose = require('mongoose');
const Ownership = require('../../models/Ownership');
const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const auditService = require('../../services/auditService');
const logger = require('../../config/logger');
const { getTransferPoints } = require('../../services/authorizationRules');
const { syncUserVip } = require('../../services/vipService');

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

exports.getTransfers = async (req, res) => {
  const { start_date, end_date, user, page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = { acquisition_type: 'transfer_out' };
    if (start_date || end_date) {
      filter.occurred_at = {};
      if (start_date) filter.occurred_at.$gte = buildDateRangeStart(start_date);
      if (end_date) filter.occurred_at.$lte = buildDateRangeEnd(end_date);
    }
    if (user) {
      const keyword = String(user).trim();
      const userRegex = new RegExp(escapeRegExp(keyword), 'i');
      const matchedUsers = await User.find({
        $or: [
          { username: userRegex },
          { qq: userRegex },
          { platform_id: userRegex }
        ]
      })
        .select('_id')
        .lean();
      if (matchedUsers.length === 0) {
        return res.json({ total: 0, page: pageNum, transfers: [] });
      }
      const userIds = matchedUsers.map((matchedUser) => matchedUser._id);
      filter.$or = [{ user_id: { $in: userIds } }, { target_user_id: { $in: userIds } }];
    }
    const total = await Ownership.countDocuments(filter);
    const transferOwnerships = await Ownership.find(filter)
      .sort({ occurred_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('user_id', 'username qq platform platform_id vip_level')
      .populate('target_user_id', 'username qq platform platform_id')
      .populate('item_id', 'name artist price')
      .lean();
    const transfers = transferOwnerships.map((ownership) => ({
      id: ownership._id,
      _id: ownership._id,
      created_at: ownership.occurred_at,
      item_name: ownership.item_id?.name || '',
      item: ownership.item_id,
      from_platform: ownership.user_id?.platform || '',
      from_id: ownership.user_id?.platform_id || ownership.user_id?.username || '',
      from_qq: ownership.user_id?.qq || '',
      from_vip_level: ownership.user_id?.vip_level || 0,
      to_platform: ownership.target_user_id?.platform || '',
      to_id: ownership.target_user_id?.platform_id || ownership.actual_display_id || ownership.target_user_id?.username || '',
      to_qq: ownership.target_user_id?.qq || ownership.actual_qq || '',
      rolled_back: ownership.active === false
    }));
    return res.json({ total, page: pageNum, transfers });
  } catch (err) {
    logger.error('getTransfers error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.rollbackTransfer = async (req, res) => {
  const { id } = req.params;
  try {
    const transferOutOwnership = await Ownership.findOne({
      _id: id,
      acquisition_type: 'transfer_out',
      active: true
    });
    if (!transferOutOwnership) {
      return res.status(404).json({ message: '转让记录不存在' });
    }

    const receiverOwnership = await Ownership.findById(transferOutOwnership.replaced_by);
    if (!receiverOwnership) {
      return res.status(404).json({ message: '找不到对应的接收方记录' });
    }

    const originalOwnership = await Ownership.findOne({
      user_id: transferOutOwnership.user_id,
      item_id: transferOutOwnership.item_id,
      acquisition_type: 'self',
      active: false
    });

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      if (originalOwnership) {
        await Ownership.findByIdAndUpdate(originalOwnership._id, { active: true }, { session });
      }

      await Ownership.findByIdAndDelete(transferOutOwnership._id, { session });
      await Ownership.findByIdAndDelete(receiverOwnership._id, { session });

      // 精确匹配转让双方的交易记录，避免误删
      await Transaction.deleteMany({
        item_id: transferOutOwnership.item_id,
        occurred_at: transferOutOwnership.occurred_at,
        type: { $in: ['transfer_out', 'transfer_in'] },
        $or: [
          { actor_id: transferOutOwnership.user_id },
          { actor_id: receiverOwnership.user_id }
        ]
      }, { session });

      const transferPoints = Math.abs(Number(receiverOwnership.points_delta || getTransferPoints(receiverOwnership, null)) || 0);
      if (transferOutOwnership.user_id) {
        await User.findByIdAndUpdate(
          transferOutOwnership.user_id,
          { $inc: { transfer_remaining: 1, points_total: transferPoints } },
          { session }
        );
      }

      if (receiverOwnership.user_id && transferPoints) {
        await User.findByIdAndUpdate(
          receiverOwnership.user_id,
          { $inc: { points_total: -transferPoints } },
          { session }
        );
        // 确保积分不为负
        await User.updateOne(
          { _id: receiverOwnership.user_id, points_total: { $lt: 0 } },
          { $set: { points_total: 0 } },
          { session }
        );
      }

      await session.commitTransaction();
    } catch (txErr) {
      await session.abortTransaction();
      throw txErr;
    } finally {
      session.endSession();
    }

    await auditService.log(req.user.id, 'rollback_transfer', 'Ownership', id, null, { rollback: true }, req);
    if (transferOutOwnership.user_id) await syncUserVip(transferOutOwnership.user_id);
    if (receiverOwnership.user_id) await syncUserVip(receiverOwnership.user_id);
    logger.info('Transfer rolled back', { ownershipId: id });
    return res.json({ message: '回滚成功' });
  } catch (err) {
    logger.error('rollbackTransfer error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
