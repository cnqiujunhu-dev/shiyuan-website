const mongoose = require('mongoose');
const Application = require('../../models/Application');
const User = require('../../models/User');
const Ownership = require('../../models/Ownership');
const Transaction = require('../../models/Transaction');
const auditService = require('../../services/auditService');
const emailService = require('../../services/emailService');
const logger = require('../../config/logger');

// 执行回购：恢复申请人所有权，停用当前持有人所有权
async function executeBuyback(application) {
  const { ownership_id, item_id } = application.payload;
  const applicantId = application.user_id;

  // 找到原转让记录（transfer_out），获取 replaced_by（对应的 transfer_in 记录 ID）
  const transferOut = await Ownership.findById(ownership_id);
  if (!transferOut || !transferOut.replaced_by) {
    throw new Error('回购链路缺失：未找到对应的转出记录');
  }

  // 找到当前持有人的有效记录。新转让链路中接收方仍显示为“自用”。
  const currentOwnership = await Ownership.findById(transferOut.replaced_by).populate('item_id', 'delivery_link price');
  if (!currentOwnership || !currentOwnership.active) {
    throw new Error('回购链路缺失：未找到当前有效持有记录');
  }

  const item = currentOwnership.item_id;
  const currentHolderId = currentOwnership.user_id;
  const now = new Date();

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 停用当前持有人的所有权
    await Ownership.findByIdAndUpdate(currentOwnership._id, { active: false }, { session });

    // 为申请人恢复“自用”所有权，但回购获得的素材不可再次转让。
    const [newOwnership] = await Ownership.create([{
      user_id: applicantId,
      item_id: item._id || item_id,
      acquisition_type: 'self',
      points_delta: 0,
      occurred_at: now,
      delivery_link: item.delivery_link,
      source_user_id: currentHolderId,
      transfer_locked: true,
      transfer_locked_reason: 'buyback',
      active: true
    }], { session });

    // Close the original transfer-out chain so it can no longer be re-bought back or rolled back.
    await Ownership.findByIdAndUpdate(
      transferOut._id,
      { replaced_by: newOwnership._id, active: false },
      { session }
    );

    // 创建交易记录
    await Transaction.create([{
      type: 'transfer_in',
      actor_id: applicantId,
      target_id: currentHolderId,
      item_id: item._id || item_id,
      price: item.price || 0,
      points_change: 0,
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

async function executeRegistrationReview(application, status, reviewerId, remark = '') {
  const user = await User.findById(application.user_id);
  if (!user) {
    throw new Error('注册申请关联用户不存在');
  }

  user.registration_status = status === 'approved' ? 'approved' : 'rejected';
  user.registration_reviewed_by = reviewerId;
  user.registration_reviewed_at = new Date();
  user.registration_reject_reason = status === 'rejected' ? remark : undefined;
  if (Array.isArray(user.identities)) {
    user.identities.forEach((identity) => {
      if (identity.status === 'pending') {
        identity.status = status === 'approved' ? 'approved' : 'rejected';
        identity.reviewed_by = reviewerId;
        identity.reviewed_at = user.registration_reviewed_at;
        identity.reject_reason = status === 'rejected' ? remark : undefined;
      }
    });
  }
  await user.save();

  if (status === 'approved') {
    await emailService.sendRegistrationApprovedEmail(user.email, {
      id: user._id,
      uid: user.uid,
      username: user.username
    });
  } else {
    await emailService.sendRegistrationRejectedEmail(user.email, {
      id: user._id,
      uid: user.uid,
      username: user.username
    }, remark);
  }
}

async function executeIdentityReview(application, status, reviewerId, remark = '') {
  const user = await User.findById(application.user_id);
  if (!user) {
    throw new Error('身份申请关联用户不存在');
  }

  const identityId = String(application.payload?.identity_id || '');
  const identity = user.identities.id(identityId);
  if (!identity) {
    throw new Error('待审核身份不存在');
  }

  identity.status = status === 'approved' ? 'approved' : 'rejected';
  identity.reviewed_by = reviewerId;
  identity.reviewed_at = new Date();
  identity.reject_reason = status === 'rejected' ? remark : undefined;
  await user.save();
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
      .populate('user_id', 'uid username email email_verified_at registration_status registration_reject_reason qq platform platform_id identities')
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
    const application = await Application.findOne({ _id: id, status: 'pending' });
    if (!application) {
      const exists = await Application.findById(id);
      if (!exists) return res.status(404).json({ message: '申请不存在' });
      return res.status(400).json({ message: '该申请已被处理' });
    }

    if (status === 'approved' && application.type === 'buyback') {
      await executeBuyback(application);
    }
    if (application.type === 'registration') {
      await executeRegistrationReview(application, status, req.user.id, remark || '');
    }
    if (application.type === 'identity') {
      await executeIdentityReview(application, status, req.user.id, remark || '');
    }

    application.status = status;
    application.decided_by = req.user.id;
    application.decided_at = new Date();
    if (remark !== undefined) application.remark = remark;
    await application.save();

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
