const Application = require('../../models/Application');
const User = require('../../models/User');
const auditService = require('../../services/auditService');
const logger = require('../../config/logger');

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
    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ message: '申请不存在' });
    }
    if (application.status !== 'pending') {
      return res.status(400).json({ message: '该申请已被处理' });
    }

    const before = { status: application.status };
    application.status = status;
    application.decided_by = req.user.id;
    application.decided_at = new Date();
    if (remark) application.remark = remark;
    await application.save();

    if (status === 'approved' && application.type === 'platform_change') {
      const user = await User.findById(application.user_id);
      if (user && application.payload && application.payload.new_platform) {
        user.platform = application.payload.new_platform;
        user.platform_changed_at = new Date();
        await user.save();
      }
    }

    await auditService.log(
      req.user.id,
      'decide_application',
      'Application',
      application._id,
      before,
      { status, remark },
      req
    );

    return res.json({ message: `申请已${status === 'approved' ? '批准' : '拒绝'}` });
  } catch (err) {
    logger.error('decideApplication error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
