const mongoose = require('mongoose');
const { parse } = require('csv-parse/sync');
const xlsx = require('xlsx');

const Item = require('../models/Item');
const User = require('../models/User');
const Ownership = require('../models/Ownership');
const Transaction = require('../models/Transaction');
const { syncUserVip } = require('./vipService');
const {
  USAGE_FIELDS,
  ACQUISITION_METHODS,
  USAGE_PURPOSES,
  normalizeUsageField,
  normalizeAcquisitionMethod,
  normalizeUsagePurpose,
  deriveLegacyAcquisitionType,
  resolvePointsAndSpend,
  shouldHaveDeliveryLink,
  shouldHidePurchaser
} = require('./authorizationRules');

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function getFirstValue(record, names) {
  for (const name of names) {
    const value = record[name];
    if (value !== undefined && value !== null && clean(value) !== '') return value;
  }
  return undefined;
}

function getRecordValue(record, names) {
  const normalized = {};
  Object.keys(record || {}).forEach((key) => {
    normalized[clean(key).replace(/\s+/g, '')] = record[key];
  });
  for (const name of names) {
    const direct = getFirstValue(record, [name]);
    if (direct !== undefined) return direct;
    const compactKey = clean(name).replace(/\s+/g, '');
    if (normalized[compactKey] !== undefined && clean(normalized[compactKey]) !== '') {
      return normalized[compactKey];
    }
  }
  return undefined;
}

function parseRecordsFromRequest(req) {
  if (req.file) {
    const originalName = req.file.originalname || '';
    const lowerName = originalName.toLowerCase();
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) return [];
      return xlsx.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: '' });
    }

    const content = req.file.buffer
      ? req.file.buffer.toString('utf8')
      : require('fs').readFileSync(req.file.path, 'utf8');
    return parse(content, { columns: true, skip_empty_lines: true, bom: true });
  }

  if (Array.isArray(req.body)) return req.body;
  return req.body?.records || req.body?.authorizations || req.body?.rows || [];
}

function resolveOccurredAt(record) {
  const raw = getRecordValue(record, ['发生时间', '导入时间', 'date', 'occurred_at']);
  const date = raw ? new Date(raw) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function findItemBySkuOrName(sku, name) {
  const skuValue = clean(sku);
  const nameValue = clean(name);
  if (skuValue) {
    const skuItem = await Item.findOne({ sku_code: skuValue });
    if (skuItem) return skuItem;
  }
  if (nameValue) {
    const exactNameItem = await Item.findOne({ name: nameValue });
    if (exactNameItem) return exactNameItem;
    return Item.findOne({ name: new RegExp(escapeRegExp(nameValue), 'i') });
  }
  return null;
}

function objectIdLike(value) {
  return /^[a-f\d]{24}$/i.test(clean(value));
}

async function findUserByDisplayId(displayId) {
  const value = clean(displayId);
  if (!value) return null;
  const or = [
    { platform_id: value },
    { 'identities.nickname': value }
  ];
  if (objectIdLike(value)) or.unshift({ _id: value });
  return User.findOne({ $or: or });
}

async function resolveUserSnapshot({ qq, displayId }) {
  const qqValue = clean(qq);
  const displayValue = clean(displayId);
  let user = null;
  if (qqValue) user = await User.findOne({ qq: qqValue });
  if (!user && displayValue) user = await findUserByDisplayId(displayValue);
  return {
    user,
    displayId: displayValue || getUserDisplayId(user),
    qq: qqValue || user?.qq || ''
  };
}

function getUserDisplayId(user) {
  if (!user) return '';
  if (user.platform_id) return user.platform_id;
  const identities = user.identities || [];
  const primary = identities.find(identity => identity.is_primary && identity.status !== 'rejected')
    || identities.find(identity => identity.status === 'approved')
    || identities[0];
  return primary?.nickname || user.username || '';
}

function transactionTypeFor(acquisitionMethod, usagePurpose) {
  if (usagePurpose === '赞助待定' || usagePurpose === '赞助确定') return 'purchase_sponsor';
  if (acquisitionMethod === '活动购买') return 'purchase_activity';
  if (acquisitionMethod === '被赞助') return 'sponsored';
  if (acquisitionMethod === '回购') return 'buyback';
  if (acquisitionMethod === '会员帮回购') return 'assisted_buyback';
  if (acquisitionMethod === '中奖') return 'lottery';
  if (acquisitionMethod === '退圈掉落') return 'retirement_drop';
  return 'purchase_self';
}

function transactionActorFor({ purchaser, actual, acquisitionMethod }) {
  if (acquisitionMethod === '被赞助') return actual.user?._id;
  return purchaser.user?._id || actual.user?._id;
}

function transactionTargetFor({ purchaser, actual, acquisitionMethod, usagePurpose }) {
  if (acquisitionMethod === '被赞助') return purchaser.user?._id;
  if (usagePurpose === '赞助确定') return actual.user?._id;
  return undefined;
}

function visibleUserForRecord({ purchaser, actual, acquisitionMethod, usagePurpose }) {
  if (usagePurpose === '赞助待定' || usagePurpose === '赞助确定') return purchaser.user?._id;
  if (acquisitionMethod === '被赞助') return actual.user?._id;
  return actual.user?._id;
}

function pointsUserForRecord({ purchaser, actual, acquisitionMethod, usagePurpose }) {
  if (usagePurpose === '赞助待定' || usagePurpose === '赞助确定') return purchaser.user?._id;
  if (acquisitionMethod === '被赞助' || acquisitionMethod === '中奖') return undefined;
  return actual.user?._id;
}

function buildOwnershipDoc({
  item,
  usageField,
  acquisitionMethod,
  usagePurpose,
  purchaser,
  actual,
  points,
  annualSpend,
  deliveryLink,
  occurredAt,
  notes
}) {
  const visibleUserId = visibleUserForRecord({ purchaser, actual, acquisitionMethod, usagePurpose });
  const pointUserId = pointsUserForRecord({ purchaser, actual, acquisitionMethod, usagePurpose });
  return {
    user_id: visibleUserId,
    item_id: item._id,
    acquisition_type: deriveLegacyAcquisitionType(acquisitionMethod, usagePurpose),
    usage_field: usageField,
    acquisition_method: acquisitionMethod,
    usage_purpose: usagePurpose,
    purchaser_user_id: purchaser.user?._id,
    purchaser_display_id: purchaser.displayId,
    purchaser_qq: purchaser.qq,
    actual_user_id: actual.user?._id,
    actual_display_id: actual.displayId,
    actual_qq: actual.qq,
    points_user_id: pointUserId,
    points_delta: points,
    annual_spend_delta: annualSpend,
    occurred_at: occurredAt,
    delivery_link: deliveryLink,
    hide_purchaser_publicly: shouldHidePurchaser(acquisitionMethod),
    notes,
    active: true
  };
}

async function applyAccounting(userId, points, annualSpend, session) {
  if (!userId || (!points && !annualSpend)) return;
  await User.findByIdAndUpdate(
    userId,
    { $inc: { points_total: points || 0, annual_spend: annualSpend || 0 } },
    { session }
  );
}

async function deductBuybackQuota(purchaserUserId, acquisitionMethod, session) {
  if (!['回购', '会员帮回购'].includes(acquisitionMethod)) return null;
  if (!purchaserUserId) {
    throw new Error(`${acquisitionMethod} 需要购买人匹配到已注册 VIP 用户`);
  }
  const purchaser = await User.findById(purchaserUserId).session(session);
  if (!purchaser || purchaser.vip_level < 1) {
    throw new Error(`${acquisitionMethod} 的购买人不是有效 VIP`);
  }
  if ((purchaser.buyback_remaining || 0) <= 0) {
    throw new Error(`${acquisitionMethod} 的购买人本年度回购次数不足`);
  }
  if (acquisitionMethod === '会员帮回购' && (purchaser.assisted_buyback_remaining || 0) <= 0) {
    throw new Error('该 VIP 本年度会员帮回购次数不足');
  }
  purchaser.buyback_remaining -= 1;
  if (acquisitionMethod === '会员帮回购') purchaser.assisted_buyback_remaining -= 1;
  await purchaser.save({ session });
  return purchaser;
}

function extractAuthorizationRow(record) {
  const sku = getRecordValue(record, ['素材 SKU', '素材SKU', 'SKU', 'sku_code', 'sku']);
  const itemName = getRecordValue(record, ['素材名称', '商品名称', 'item_name', 'name']);
  const usageFieldRaw = getRecordValue(record, ['使用领域', '授权领域', '领域', 'usage_field', 'domain']);
  const acquisitionMethodRaw = getRecordValue(record, ['获取途径', '获取方式', 'acquisition_method', 'method']);
  const usagePurposeRaw = getRecordValue(record, ['用途', 'usage_purpose', 'purpose']);
  const purchaserDisplayId = getRecordValue(record, ['购买人 ID', '购买人ID', '购买人圈名ID', 'purchaser_id', 'buyer_id']);
  const purchaserQq = getRecordValue(record, ['购买人 QQ', '购买人QQ', 'purchaser_qq', 'buyer_qq']);
  const actualDisplayId = getRecordValue(record, ['实际使用人 ID', '实际使用人ID', '实际使用人圈名ID', 'actual_id', 'actual_user_id']);
  const actualQq = getRecordValue(record, ['实际使用人 QQ', '实际使用人QQ', 'actual_qq', 'actual_user_qq']);
  const points = getRecordValue(record, ['积分', 'points', 'points_delta']);
  const deliveryLink = getRecordValue(record, ['发货链接', 'delivery_link']);
  const notes = getRecordValue(record, ['备注', 'notes', 'remark']);
  return {
    sku,
    itemName,
    usageFieldRaw,
    acquisitionMethodRaw,
    usagePurposeRaw,
    purchaserDisplayId,
    purchaserQq,
    actualDisplayId,
    actualQq,
    points,
    deliveryLink,
    notes
  };
}

function validateRowShape(row) {
  if (!clean(row.sku) && !clean(row.itemName)) return '素材 SKU 和素材名称至少填写一个';
  const usageField = normalizeUsageField(row.usageFieldRaw);
  if (!usageField) return `使用领域仅支持：${USAGE_FIELDS.join('、')}`;
  const acquisitionMethod = normalizeAcquisitionMethod(row.acquisitionMethodRaw, '');
  if (!acquisitionMethod) return `获取途径仅支持：${ACQUISITION_METHODS.join('、')}`;
  const usagePurpose = normalizeUsagePurpose(row.usagePurposeRaw, '');
  if (!usagePurpose) return `用途仅支持：${USAGE_PURPOSES.join('、')}`;
  if (!clean(row.purchaserDisplayId) && !clean(row.purchaserQq)) return '购买人 ID 和购买人 QQ 至少填写一个';
  const isSponsorPending = usagePurpose === '赞助待定';
  if (!isSponsorPending && !clean(row.actualDisplayId) && !clean(row.actualQq)) {
    return '非赞助待定记录需要填写实际使用人 ID 或 QQ';
  }
  const hasManualPoints = row.points !== undefined && row.points !== null && clean(row.points) !== '';
  if (hasManualPoints && !Number.isFinite(Number(row.points))) return '积分不是有效数字';
  return null;
}

async function importAuthorizationRows(records) {
  const imported = [];
  const errors = [];
  const syncedUserIds = new Set();

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const row = extractAuthorizationRow(record);
    const shapeError = validateRowShape(row);
    if (shapeError) {
      errors.push({ index: i, row: i + 2, record, error: shapeError });
      continue;
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const usageField = normalizeUsageField(row.usageFieldRaw);
      const acquisitionMethod = normalizeAcquisitionMethod(row.acquisitionMethodRaw, '');
      const usagePurpose = normalizeUsagePurpose(row.usagePurposeRaw, '');
      const item = await findItemBySkuOrName(row.sku, row.itemName);
      if (!item) throw new Error(`找不到素材：${clean(row.sku || row.itemName)}`);

      const purchaser = await resolveUserSnapshot({
        qq: row.purchaserQq,
        displayId: row.purchaserDisplayId
      });
      let actual = await resolveUserSnapshot({
        qq: row.actualQq,
        displayId: row.actualDisplayId
      });
      if (usagePurpose !== '赞助待定' && !actual.displayId && !actual.qq) {
        actual = { ...purchaser };
      }

      const { points, annualSpend } = resolvePointsAndSpend({
        item,
        acquisitionMethod,
        usagePurpose,
        pointsValue: row.points
      });
      const deliveryLink = shouldHaveDeliveryLink(acquisitionMethod, usagePurpose)
        ? clean(row.deliveryLink) || item.delivery_link || ''
        : '';
      const occurredAt = resolveOccurredAt(record);

      await deductBuybackQuota(purchaser.user?._id, acquisitionMethod, session);

      const docsToCreate = [
        buildOwnershipDoc({
          item,
          usageField,
          acquisitionMethod,
          usagePurpose,
          purchaser,
          actual,
          points,
          annualSpend,
          deliveryLink,
          occurredAt,
          notes: clean(row.notes)
        })
      ];

      if (['购买', '活动购买'].includes(acquisitionMethod) && usagePurpose === '赞助确定') {
        const sponsoredDoc = buildOwnershipDoc({
          item,
          usageField,
          acquisitionMethod: '被赞助',
          usagePurpose: '自用',
          purchaser,
          actual,
          points: 0,
          annualSpend: 0,
          deliveryLink: clean(row.deliveryLink) || item.delivery_link || '',
          occurredAt,
          notes: clean(row.notes)
        });
        docsToCreate.push(sponsoredDoc);
      }

      const createdOwnerships = await Ownership.create(docsToCreate, { session });
      if (createdOwnerships.length > 1) {
        await Ownership.findByIdAndUpdate(
          createdOwnerships[0]._id,
          { related_ownership_id: createdOwnerships[1]._id, target_user_id: actual.user?._id },
          { session }
        );
        await Ownership.findByIdAndUpdate(
          createdOwnerships[1]._id,
          { related_ownership_id: createdOwnerships[0]._id, source_user_id: purchaser.user?._id },
          { session }
        );
      }

      const pointUserId = pointsUserForRecord({ purchaser, actual, acquisitionMethod, usagePurpose });
      await applyAccounting(pointUserId, points, annualSpend, session);
      if (pointUserId) syncedUserIds.add(String(pointUserId));

      const transactionDocs = [{
        type: transactionTypeFor(acquisitionMethod, usagePurpose),
        actor_id: transactionActorFor({ purchaser, actual, acquisitionMethod }),
        target_id: transactionTargetFor({ purchaser, actual, acquisitionMethod, usagePurpose }),
        item_id: item._id,
        price: item.price,
        points_change: points,
        annual_spend_change: annualSpend,
        has_delivery_link: Boolean(deliveryLink),
        occurred_at: occurredAt,
        metadata: {
          usage_field: usageField,
          acquisition_method: acquisitionMethod,
          usage_purpose: usagePurpose,
          purchaser_display_id: purchaser.displayId,
          purchaser_qq: purchaser.qq,
          actual_display_id: actual.displayId,
          actual_qq: actual.qq,
          ownership_ids: createdOwnerships.map(ownership => ownership._id)
        }
      }];
      if (createdOwnerships.length > 1) {
        transactionDocs.push({
          type: 'sponsored',
          actor_id: actual.user?._id,
          target_id: purchaser.user?._id,
          item_id: item._id,
          price: item.price,
          points_change: 0,
          annual_spend_change: 0,
          has_delivery_link: true,
          occurred_at: occurredAt,
          metadata: {
            usage_field: usageField,
            acquisition_method: '被赞助',
            usage_purpose: '自用',
            purchaser_display_id: purchaser.displayId,
            purchaser_qq: purchaser.qq,
            actual_display_id: actual.displayId,
            actual_qq: actual.qq,
            ownership_id: createdOwnerships[1]._id
          }
        });
      }
      await Transaction.create(transactionDocs, { session });

      await session.commitTransaction();
      imported.push({
        index: i,
        row: i + 2,
        item: item.name,
        usage_field: usageField,
        acquisition_method: acquisitionMethod,
        usage_purpose: usagePurpose
      });
    } catch (err) {
      await session.abortTransaction();
      errors.push({ index: i, row: i + 2, record, error: err.message });
    } finally {
      session.endSession();
    }
  }

  for (const userId of syncedUserIds) {
    await syncUserVip(userId);
  }

  return { imported, errors };
}

module.exports = {
  parseRecordsFromRequest,
  importAuthorizationRows,
  resolveUserSnapshot,
  getUserDisplayId
};
