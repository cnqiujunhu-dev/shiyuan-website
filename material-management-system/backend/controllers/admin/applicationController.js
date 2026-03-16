const mongoose = require('mongoose');
const Application = require('../../models/Application');
const User = require('../../models/User');
const Ownership = require('../../models/Ownership');
const Transaction = require('../../models/Transaction');
const auditService = require('../../services/auditService');
const logger = require('../../config/logger');

// 执行回购：恢复申请人所有权，停用当前持有人所有权
async function executeBuyback(application) {
  const { ownership_id, item_id } = application.payload;
  const applicantId = application.user_id;

  // 找到原转让记录（transfer_out），获取 replaced_by（对应的 transfer_in 记录 ID）
  const transferOut = await Ownership.findById(ownership_id);
  if (!transferOut || !transferOut.replaced_by) {
    logger.warn('Buyback: transfer_out not found or missing replaced_by', { ownership_id });
    return;
  }

  // 找到当前持有人的 transfer_in 记录
  const transferIn = await Ownership.findById(transferOut.replaced_by).populate('item_id', 'delivery_link price');
  if (!transferIn || !transferIn.active) {
    logger.warn('Buyback: transfer_in not active', { transferInId: transferOut.replaced_by });
    return;
  }

  const item = transferIn.item_id;
  const currentHolderId = transferIn.user_id;
  const now = new Date();

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 停用当前持有人的所有权
    await Ownership.findByIdAndUpdate(transferIn._id, { active: false }, { session });

    // 为申请人创建新的所有权（buyback 类型）
    const [newOwnership] = await Ownership.create([{
      user_id: applicantId,
      item_id: item._id || item_id,
      acquisition_type: 'transfer_in',
      points_delta: item.price || 0,
      occurred_at: now,
      delivery_link: item.delivery_link,
      source_user_id: currentHolderId,
      active: true
    }], { session });

    // 更新原 transfer_out 记录的 replaced_by 指向新所有权
    await Ownership.findByIdAndUpdate(transferOut._id, { replaced_by: newOwnership._id }, { session });

    // 创建交易记录
    await Transaction.create([{
      type: 'transfer_in',
      actor_id: applicantId,
      target_id: currentHolderId,
      item_id: item._id || item_id,
      price: item.price || 0,
      points_change: item.price || 0,
      has_delivery_link: true,
      occurred_at: now,
      metadata: { buyback: true }
    }, {
      type: 'transfer_out',
      actor_id: currentHolderId,
      target_id: applicantId,
      item_id: item._id || item_id,
      price: item.price || 0,
      points_change: 0,
      has_delivery_link: false,
      occurred_at: now,
      metadata: { buyback: true }
    }], { session });

    // 扣减申请人的回购次数
    await User.findByIdAndUpdate(applicantId, { $inc: { buyback_remaining: -1 } }, { session });
    // 当前持有人积分扣减（转出时本来就未增加，维持原状）

    await session.commitTransaction();
    logger.info('Buyback executed', { applicantId, currentHolderId, item: item._id || item_id });
  } catch (err) {
    await session.abortTransaction();
    logger.error('Buyback execution failed', { message: err.message });
    throw err;
  } finally {
    session.endSession();
  }
}

exports.getApplications = async (req, res) => {
  const { type, status, page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    const total = await Application.countDocuments(filter);
    const applications = await Application.find(filter)
      .sort({ created_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('user_id', 'username qq platform platform_id')
      .lean();
    return res.json({ total, page: pageNum, applications });
  } catch (err) {
    logger.error('getApplications error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.decideApplication = async (req, res) => {
  const { id } = req.params;
  const { status, remark } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ message: '无效的审批状态' });
  }
  try {
    const updateFields = {
      status,
      decided_by: req.user.id,
      decided_at: new Date()
    };
    if (remark) updateFields.remark = remark;

    const application = await Application.findOneAndUpdate(
      { _id: id, status: 'pending' },
      { $set: updateFields },
      { new: true }
    );
    if (!application) {
      const exists = await Application.findById(id);
      if (!exists) return res.status(404).json({ message: '申请不存在' });
      return res.status(400).json({ message: '该申请已被处理' });
    }

    if (status === 'approved') {
      if (application.type === 'platform_change') {
        const user = await User.findById(application.user_id);
        if (user && application.payload?.new_platform) {
          user.platform = application.payload.new_platform;
          user.platform_changed_at = new Date();
          await user.save();
        }
      } else if (application.type === 'buyback') {
        await executeBuyback(application);
      }
    }

    await auditService.log(
      req.user.id,
      'decide_application',
      'Application',
      application._id,
      { status: 'pending' },
      { status, remark },
      req
    );

    return res.json({ message: `申请已${status === 'approved' ? '批准' : '拒绝'}` });
  } catch (err) {
    logger.error('decideApplication error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
