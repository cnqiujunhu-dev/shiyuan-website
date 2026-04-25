const bcrypt = require('bcryptjs');
const { parse } = require('csv-parse/sync');
const Item = require('../../models/Item');
const User = require('../../models/User');
const Ownership = require('../../models/Ownership');
const Transaction = require('../../models/Transaction');
const { syncUserVip } = require('../../services/vipService');
const auditService = require('../../services/auditService');
const logger = require('../../config/logger');

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

function resolveOccurredAt(record) {
  return record.date || record.occurred_at ? new Date(record.date || record.occurred_at) : new Date();
}

function buildTransactionDocFromOwnership({ acquisitionType, actorId, targetId, item, pointsDelta, deliveryLink, occurredAt }) {
  const price = pointsDelta > 0 ? pointsDelta : item.price;

  if (acquisitionType === 'self') {
    return {
      type: 'purchase_self',
      actor_id: actorId,
      item_id: item._id,
      price,
      points_change: pointsDelta,
      has_delivery_link: Boolean(deliveryLink || item.delivery_link),
      occurred_at: occurredAt
    };
  }

  if (acquisitionType === 'sponsor' || acquisitionType === 'sponsor_pending') {
    return {
      type: 'purchase_sponsor',
      actor_id: actorId,
      target_id: targetId,
      item_id: item._id,
      price,
      points_change: pointsDelta,
      has_delivery_link: false,
      occurred_at: occurredAt
    };
  }

  if (acquisitionType === 'sponsored') {
    return {
      type: 'sponsored',
      actor_id: actorId,
      target_id: targetId,
      item_id: item._id,
      price,
      points_change: pointsDelta,
      has_delivery_link: true,
      occurred_at: occurredAt
    };
  }

  return null;
}

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

// Import transactions (original format)
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
      const occurredAt = resolveOccurredAt(rec);

      let item = null;
      if (rec.item_id) {
        item = await Item.findById(rec.item_id);
      }
      if (!item && rec.sku_code) {
        item = await Item.findOne({ sku_code: String(rec.sku_code).trim() });
      }
      if (!item && rec.item_name) {
        item = await Item.findOne({ name: new RegExp(escapeRegExp(rec.item_name.trim()), 'i') });
      }
      if (!item) {
        errors.push({ index: i, record: rec, error: '找不到商品' });
        continue;
      }
      const normalizedPrice = rec.price == null ? Number(item.price) : Number(rec.price);
      if (Number.isNaN(normalizedPrice)) {
        errors.push({ index: i, record: rec, error: 'price 字段不是有效数字' });
        continue;
      }

      const actor = await findOrCreateUser(rec.actor_qq, rec.actor_platform, rec.actor_id);

      if (rec.type === 'sponsor' || rec.type === 'purchase_sponsor') {
        const target = await findOrCreateUser(rec.target_qq, rec.target_platform, rec.target_id);
        if (!target) {
          errors.push({ index: i, record: rec, error: '找不到赞助目标用户' });
          continue;
        }

        await Ownership.create([
          {
            user_id: actor._id,
            item_id: item._id,
            acquisition_type: 'sponsor',
            points_delta: normalizedPrice,
            occurred_at: occurredAt,
            target_user_id: target._id,
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
            price: normalizedPrice,
            points_change: normalizedPrice,
            has_delivery_link: false,
            occurred_at: occurredAt
          },
          {
            type: 'sponsored',
            actor_id: target._id,
            target_id: actor._id,
            item_id: item._id,
            price: normalizedPrice,
            points_change: 0,
            has_delivery_link: true,
            occurred_at: occurredAt
          }
        ]);

        actor.points_total += normalizedPrice;
        actor.annual_spend += normalizedPrice;
        await actor.save();
        await syncUserVip(actor._id);
      } else {
        await Ownership.create({
          user_id: actor._id,
          item_id: item._id,
          acquisition_type: 'self',
          points_delta: normalizedPrice,
          occurred_at: occurredAt,
          delivery_link: item.delivery_link,
          active: true
        });

        await Transaction.create({
          type: 'purchase_self',
          actor_id: actor._id,
          item_id: item._id,
          price: normalizedPrice,
          points_change: normalizedPrice,
          has_delivery_link: true,
          occurred_at: occurredAt
        });

        actor.points_total += normalizedPrice;
        actor.annual_spend += normalizedPrice;
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

// Import authorization records (new format with dual-user support)
exports.importAuthorizations = async (req, res) => {
  let records = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ message: '请提供有效的授权记录数组' });
  }

  const imported = [];
  const errors = [];

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    try {
      const occurredAt = resolveOccurredAt(rec);
      const itemKeyword = String(rec.sku_code || rec.name || rec.item_name || '').trim();
      if (!itemKeyword) {
        errors.push({ index: i, record: rec, error: '缺少素材名称或 SKU 编码' });
        continue;
      }
      const item = await Item.findOne({
        $or: [
          { sku_code: itemKeyword },
          { name: new RegExp(escapeRegExp(itemKeyword), 'i') }
        ]
      });
      if (!item) {
        errors.push({ index: i, record: rec, error: `找不到素材: ${itemKeyword}` });
        continue;
      }

      const type1 = rec.acquisition_type_1 || rec.type1;
      const id1 = rec.id1;
      const qq1 = rec.qq1;
      const points1 = Number(rec.points1 || 0);
      const delivery1 = rec.delivery_link_1 || '';

      if (!type1 || (!id1 && !qq1)) {
        errors.push({ index: i, record: rec, error: '缺少用户1的获取类型或ID/QQ' });
        continue;
      }

      // Map Chinese type names to internal types
      const typeMap = { '自用': 'self', '已赞助': 'sponsor', '赞待': 'sponsor_pending', '赞助待定': 'sponsor_pending', '被赞助': 'sponsored' };
      const mappedType1 = typeMap[type1] || type1;

      const user1 = await findOrCreateUser(qq1, null, id1);

      // Create ownership for user 1
      await Ownership.create({
        user_id: user1._id,
        item_id: item._id,
        acquisition_type: mappedType1,
        points_delta: points1,
        occurred_at: occurredAt,
        delivery_link: delivery1 || (mappedType1 === 'self' ? item.delivery_link : undefined),
        active: true
      });

      // Update user1 points
      if (points1 > 0) {
        user1.points_total += points1;
        user1.annual_spend += points1;
        await user1.save();
        await syncUserVip(user1._id);
      }

      // Handle user 2 if present (for sponsor relationships)
      const type2 = rec.acquisition_type_2 || rec.type2;
      const id2 = rec.id2;
      const qq2 = rec.qq2;
      const points2 = Number(rec.points2 || 0);
      const delivery2 = rec.delivery_link_2 || '';

      if (type2 && (id2 || qq2)) {
        const mappedType2 = typeMap[type2] || type2;
        const user2 = await findOrCreateUser(qq2, null, id2);

        await Ownership.create({
          user_id: user2._id,
          item_id: item._id,
          acquisition_type: mappedType2,
          points_delta: points2,
          occurred_at: occurredAt,
          delivery_link: delivery2 || (mappedType2 === 'sponsored' ? item.delivery_link : undefined),
          source_user_id: mappedType2 === 'sponsored' ? user1._id : undefined,
          active: true
        });

        // Link user1 to user2 if sponsor relationship
        if (mappedType1 === 'sponsor' && mappedType2 === 'sponsored') {
          await Ownership.findOneAndUpdate(
            { user_id: user1._id, item_id: item._id, acquisition_type: 'sponsor', active: true },
            { target_user_id: user2._id }
          );
        }

        if (points2 > 0) {
          user2.points_total += points2;
          user2.annual_spend += points2;
          await user2.save();
          await syncUserVip(user2._id);
        }
      }

      const transactionDocs = [];
      const user2Id = type2 && (id2 || qq2) ? (await User.findOne({
        $or: [
          ...(qq2 ? [{ qq: qq2 }] : []),
          ...(id2 ? [{ platform_id: id2 }] : [])
        ]
      }).select('_id').lean())?._id : null;

      const tx1 = buildTransactionDocFromOwnership({
        acquisitionType: mappedType1,
        actorId: user1._id,
        targetId: mappedType1 === 'sponsor' ? user2Id : undefined,
        item,
        pointsDelta: points1,
        deliveryLink: delivery1,
        occurredAt
      });
      if (tx1) transactionDocs.push(tx1);

      if (type2 && (id2 || qq2)) {
        const mappedType2 = typeMap[type2] || type2;
        const user2 = await findOrCreateUser(qq2, null, id2);
        const tx2 = buildTransactionDocFromOwnership({
          acquisitionType: mappedType2,
          actorId: user2._id,
          targetId: mappedType2 === 'sponsored' ? user1._id : undefined,
          item,
          pointsDelta: points2,
          deliveryLink: delivery2,
          occurredAt
        });
        if (tx2) transactionDocs.push(tx2);
      }

      if (transactionDocs.length > 0) {
        await Transaction.create(transactionDocs);
      }

      imported.push({ index: i, name: item.name, user1: user1.username });
    } catch (err) {
      errors.push({ index: i, record: rec, error: err.message });
    }
  }

  await auditService.log(req.user.id, 'import_authorizations', 'Ownership', null, null, { imported: imported.length, failed: errors.length }, req);
  logger.info('Authorizations imported', { imported: imported.length, failed: errors.length });
  return res.json({ imported: imported.length, failed: errors.length, errors });
};

exports.getTransactions = async (req, res) => {
  const {
    type,
    user,
    user_id,
    item_id,
    date_from,
    date_to,
    page = 1,
    limit = 20
  } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = {};
    if (type) filter.type = type;
    if (item_id) filter.item_id = item_id;
    if (user_id) {
      filter.$or = [{ actor_id: user_id }, { target_id: user_id }];
    } else if (user) {
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
        return res.json({ total: 0, page: pageNum, transactions: [] });
      }
      const userIds = matchedUsers.map((matchedUser) => matchedUser._id);
      filter.$or = [{ actor_id: { $in: userIds } }, { target_id: { $in: userIds } }];
    }
    if (date_from || date_to) {
      filter.occurred_at = {};
      if (date_from) filter.occurred_at.$gte = buildDateRangeStart(date_from);
      if (date_to) filter.occurred_at.$lte = buildDateRangeEnd(date_to);
    }
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
