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

    const actor = await User.findById(transferOutOwnership.user_id);
    const targetUser = await User.findById(transferInOwnership.user_id);
    const item = transferOutOwnership.item_id;

    if (originalOwnership) {
      originalOwnership.active = true;
      await originalOwnership.save();
    }

    await Ownership.findByIdAndDelete(transferOutOwnership._id);
    await Ownership.findByIdAndDelete(transferInOwnership._id);

    await Transaction.deleteMany({
      item_id: transferOutOwnership.item_id,
      occurred_at: transferOutOwnership.occurred_at,
      type: { $in: ['transfer_out', 'transfer_in'] }
    });

    if (actor) {
      actor.transfer_remaining += 1;
      await actor.save();
    }

    if (targetUser && transferInOwnership.points_delta) {
      targetUser.points_total = Math.max(0, targetUser.points_total - transferInOwnership.points_delta);
      await targetUser.save();
    }

    await auditService.log(req.user.id, 'rollback_transfer', 'Ownership', id, null, { rollback: true }, req);
    logger.info('Transfer rolled back', { ownershipId: id });
    return res.json({ message: '回滚成功' });
  } catch (err) {
    logger.error('rollbackTransfer error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
