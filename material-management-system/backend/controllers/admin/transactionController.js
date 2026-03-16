const bcrypt = require('bcryptjs');
const { parse } = require('csv-parse/sync');
const Item = require('../../models/Item');
const User = require('../../models/User');
const Ownership = require('../../models/Ownership');
const Transaction = require('../../models/Transaction');
const { syncUserVip } = require('../../services/vipService');
const auditService = require('../../services/auditService');
const logger = require('../../config/logger');

async function findOrCreateUser(qq, platform, platformId) {
  let user = null;
  if (qq) user = await User.findOne({ qq });
  if (!user && platform && platformId) user = await User.findOne({ platform, platform_id: platformId });
  if (!user) {
    const username = qq || platformId || `user_${Date.now()}`;
    user = await User.create({
      username,
      password_hash: 'IMPORTED',
      qq: qq || undefined,
      platform: platform || undefined,
      platform_id: platformId || undefined
    });
  }
  return user;
}

exports.importTransactions = async (req, res) => {
  let records = req.body;

  if (req.file) {
    try {
      const content = req.file.buffer ? req.file.buffer.toString() : require('fs').readFileSync(req.file.path, 'utf8');
      records = parse(content, { columns: true, skip_empty_lines: true });
    } catch (parseErr) {
      return res.status(400).json({ message: 'CSV 解析失败', error: parseErr.message });
    }
  }

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ message: '请提供有效的交易记录数组' });
  }

  const imported = [];
  const errors = [];

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    try {
      const occurredAt = rec.date ? new Date(rec.date) : new Date();

      let item = null;
      if (rec.item_id) {
        item = await Item.findById(rec.item_id);
      }
      if (!item && rec.item_name) {
        item = await Item.findOne({ name: new RegExp(rec.item_name.trim(), 'i') });
      }
      if (!item) {
        errors.push({ index: i, record: rec, error: '找不到商品' });
        continue;
      }

      const actor = await findOrCreateUser(rec.actor_qq, rec.actor_platform, rec.actor_id);

      if (rec.type === 'sponsor') {
        const target = await findOrCreateUser(rec.target_qq, rec.target_platform, rec.target_id);
        if (!target) {
          errors.push({ index: i, record: rec, error: '找不到赞助目标用户' });
          continue;
        }

        await Ownership.create([
          {
            user_id: actor._id,
            item_id: item._id,
            acquisition_type: 'self',
            points_delta: item.price,
            occurred_at: occurredAt,
            active: true
          },
          {
            user_id: target._id,
            item_id: item._id,
            acquisition_type: 'sponsored',
            points_delta: 0,
            occurred_at: occurredAt,
            delivery_link: item.delivery_link,
            source_user_id: actor._id,
            active: true
          }
        ]);

        await Transaction.create([
          {
            type: 'purchase_sponsor',
            actor_id: actor._id,
            target_id: target._id,
            item_id: item._id,
            price: item.price,
            points_change: item.price,
            has_delivery_link: false,
            occurred_at: occurredAt
          },
          {
            type: 'sponsored',
            actor_id: target._id,
            target_id: actor._id,
            item_id: item._id,
            price: item.price,
            points_change: 0,
            has_delivery_link: true,
            occurred_at: occurredAt
          }
        ]);

        actor.points_total += item.price;
        actor.annual_spend += item.price;
        await actor.save();
        await syncUserVip(actor._id);
      } else {
        await Ownership.create({
          user_id: actor._id,
          item_id: item._id,
          acquisition_type: 'self',
          points_delta: item.price,
          occurred_at: occurredAt,
          delivery_link: item.delivery_link,
          active: true
        });

        await Transaction.create({
          type: 'purchase_self',
          actor_id: actor._id,
          item_id: item._id,
          price: item.price,
          points_change: item.price,
          has_delivery_link: true,
          occurred_at: occurredAt
        });

        actor.points_total += item.price;
        actor.annual_spend += item.price;
        await actor.save();
        await syncUserVip(actor._id);
      }

      imported.push({ index: i, actor: actor.username, item: item.name });
    } catch (err) {
      errors.push({ index: i, record: rec, error: err.message });
    }
  }

  await auditService.log(req.user.id, 'import_transactions', 'Transaction', null, null, { imported: imported.length, failed: errors.length }, req);
  logger.info('Transactions imported', { imported: imported.length, failed: errors.length });
  return res.json({ imported: imported.length, failed: errors.length, errors });
};

exports.getTransactions = async (req, res) => {
  const { type, user_id, item_id, page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = {};
    if (type) filter.type = type;
    if (user_id) filter.$or = [{ actor_id: user_id }, { target_id: user_id }];
    if (item_id) filter.item_id = item_id;
    const total = await Transaction.countDocuments(filter);
    const transactions = await Transaction.find(filter)
      .sort({ occurred_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('actor_id', 'username qq platform platform_id')
      .populate('target_id', 'username qq platform platform_id')
      .populate('item_id', 'name artist price')
      .lean();
    return res.json({ total, page: pageNum, transactions });
  } catch (err) {
    logger.error('getTransactions error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
