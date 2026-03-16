const mongoose = require('mongoose');
const Ownership = require('../../models/Ownership');
const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const auditService = require('../../services/auditService');
const logger = require('../../config/logger');

exports.getTransfers = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = { acquisition_type: { $in: ['transfer_out', 'transfer_in'] } };
    const total = await Ownership.countDocuments(filter);
    const transfers = await Ownership.find(filter)
      .sort({ occurred_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('user_id', 'username qq platform platform_id')
      .populate('item_id', 'name artist price')
      .populate('source_user_id', 'username qq platform platform_id')
      .lean();
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
      acquisition_type: 'transfer_out'
    });
    if (!transferOutOwnership) {
      return res.status(404).json({ message: '转让记录不存在' });
    }

    const transferInOwnership = await Ownership.findById(transferOutOwnership.replaced_by);
    if (!transferInOwnership) {
      return res.status(404).json({ message: '找不到对应的转入记录' });
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
      await Ownership.findByIdAndDelete(transferInOwnership._id, { session });

      // 精确匹配转让双方的交易记录，避免误删
      await Transaction.deleteMany({
        item_id: transferOutOwnership.item_id,
        occurred_at: transferOutOwnership.occurred_at,
        type: { $in: ['transfer_out', 'transfer_in'] },
        $or: [
          { actor_id: transferOutOwnership.user_id },
          { actor_id: transferInOwnership.user_id }
        ]
      }, { session });

      if (transferOutOwnership.user_id) {
        await User.findByIdAndUpdate(
          transferOutOwnership.user_id,
          { $inc: { transfer_remaining: 1 } },
          { session }
        );
      }

      if (transferInOwnership.user_id && transferInOwnership.points_delta) {
        await User.findByIdAndUpdate(
          transferInOwnership.user_id,
          { $inc: { points_total: -transferInOwnership.points_delta } },
          { session }
        );
        // 确保积分不为负
        await User.updateOne(
          { _id: transferInOwnership.user_id, points_total: { $lt: 0 } },
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
    logger.info('Transfer rolled back', { ownershipId: id });
    return res.json({ message: '回滚成功' });
  } catch (err) {
    logger.error('rollbackTransfer error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
