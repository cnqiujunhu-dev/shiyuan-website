const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Item = require('../../models/Item');
const Ownership = require('../../models/Ownership');
const User = require('../../models/User');
const { syncUserVip } = require('../../services/vipService');
const logger = require('../../config/logger');
const { normalizePublicUrl, normalizeItem } = require('../../utils/publicUrl');
const {
  normalizeUsageField,
  normalizeAcquisitionMethod,
  normalizeUsagePurpose,
  deriveLegacyAcquisitionType
} = require('../../services/authorizationRules');

const uploadDir = path.join(process.env.UPLOAD_DIR || 'uploads', 'items');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `item_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      return cb(new Error('只允许上传图片文件'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

function parseList(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
  if (!value) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
    } catch {
      // Fall through to delimiter parsing.
    }
    return trimmed.split(/[,，、/|]/).map(v => v.trim()).filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

function parseBoolean(value) {
  if (value === true || value === false) return value;
  if (value === undefined || value === null || value === '') return false;
  return ['true', '1', 'yes', 'y', '是', '开启'].includes(String(value).trim().toLowerCase());
}

function normalizeStatus(value) {
  const raw = String(value || '').trim();
  const map = {
    '在售': 'on_sale',
    '结车': 'completed',
    '下架': 'off_sale',
    on_sale: 'on_sale',
    completed: 'completed',
    off_sale: 'off_sale'
  };
  return map[raw] || 'on_sale';
}

function normalizeMaterialDomain(value) {
  const raw = String(value || '').trim();
  const map = {
    文游: '文游类',
    文游类: '文游类',
    文游作者: '文游类',
    美工: '美工美化类',
    美化: '美工美化类',
    美工美化: '美工美化类',
    美工美化类: '美工美化类'
  };
  return map[raw] || '美工美化类';
}

function escapeCsv(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

exports.uploadMiddleware = (req, res, next) => {
  upload.single('preview')(req, res, (err) => {
    if (err instanceof multer.MulterError || err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

exports.createItem = async (req, res) => {
  try {
    const {
      sku_code,
      name,
      artist,
      categories,
      topics,
      price,
      delivery_link,
      status,
      priority_only,
      queue_enabled
    } = req.body;
    const preview_url = req.file
      ? normalizePublicUrl(req.file.path)
      : normalizePublicUrl(req.body.preview_url || undefined);

    const parsedTopics = parseList(topics);
    const parsedCategories = parseList(categories);

    const item = await Item.create({
      sku_code: sku_code || undefined,
      name,
      artist,
      topics: parsedTopics,
      categories: parsedCategories,
      price: Number(price),
      preview_url,
      delivery_link,
      status: normalizeStatus(status),
      priority_only: parseBoolean(priority_only),
      queue_enabled: parseBoolean(queue_enabled)
    });
    logger.info('Item created', { itemId: item._id, name });
    return res.status(201).json({ message: '商品创建成功', item: normalizeItem(item) });
  } catch (err) {
    logger.error('createItem error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.updateItem = async (req, res) => {
  const { id } = req.params;
  try {
    const {
      sku_code,
      name,
      artist,
      categories,
      topics,
      price,
      delivery_link,
      status,
      priority_only,
      queue_enabled
    } = req.body;
    const updates = {};
    if (sku_code !== undefined) updates.sku_code = sku_code;
    if (name !== undefined) updates.name = name;
    if (artist !== undefined) updates.artist = artist;
    if (topics !== undefined) updates.topics = parseList(topics);
    if (categories !== undefined) updates.categories = parseList(categories);
    if (price !== undefined) updates.price = Number(price);
    if (delivery_link !== undefined) updates.delivery_link = delivery_link;
    if (status !== undefined) updates.status = normalizeStatus(status);
    if (priority_only !== undefined) updates.priority_only = parseBoolean(priority_only);
    if (queue_enabled !== undefined) updates.queue_enabled = parseBoolean(queue_enabled);
    if (req.file) updates.preview_url = normalizePublicUrl(req.file.path);
    if (req.body.preview_url !== undefined && !req.file) updates.preview_url = normalizePublicUrl(req.body.preview_url);

    const item = await Item.findByIdAndUpdate(id, updates, { new: true });
    if (!item) {
      return res.status(404).json({ message: '商品不存在' });
    }
    logger.info('Item updated', { itemId: id });
    return res.json({ message: '商品已更新', item: normalizeItem(item) });
  } catch (err) {
    logger.error('updateItem error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ message: '商品不存在' });
    return res.json({ item: normalizeItem(item) });
  } catch (err) {
    logger.error('getItemById error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.getItems = async (req, res) => {
  const { page = 1, limit = 20, status, artist, name } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = {};
    if (status) filter.status = status;
    if (artist) filter.artist = new RegExp(artist, 'i');
    if (name) filter.name = new RegExp(name, 'i');
    const total = await Item.countDocuments(filter);
    const items = await Item.find(filter)
      .sort({ created_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();
    return res.json({ total, page: pageNum, items: items.map(normalizeItem) });
  } catch (err) {
    logger.error('getItems error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.importItems = async (req, res) => {
  const { items: rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: '请提供商品数据数组' });
  }
  try {
    const results = { success: 0, errors: [] };
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.name || !row.artist || row.price === undefined || row.price === null || row.price === '') {
          results.errors.push({ index: i, name: row.name || `第${i + 1}行`, error: '缺少必填字段(name/artist/price)' });
          continue;
        }
        const normalizedPrice = Number(row.price);
        if (Number.isNaN(normalizedPrice)) {
          results.errors.push({ index: i, name: row.name || `第${i + 1}行`, error: 'price 字段不是有效数字' });
          continue;
        }
        await Item.create({
          sku_code: row.sku_code || undefined,
          name: row.name,
          artist: row.artist,
          topics: parseList(row.topics || row.topic),
          categories: parseList(row.categories || row.category),
          price: normalizedPrice,
          preview_url: normalizePublicUrl(row.preview_url || row.image_url || row.preview),
          delivery_link: row.delivery_link || '',
          status: normalizeStatus(row.status),
          priority_only: parseBoolean(row.priority_only),
          queue_enabled: parseBoolean(row.queue_enabled)
        });
        results.success++;
      } catch (err) {
        results.errors.push({ index: i, name: row.name || `第${i + 1}行`, error: err.message });
      }
    }
    logger.info('Items batch imported', { success: results.success, errors: results.errors.length });
    return res.json({ message: `成功导入 ${results.success} 件，失败 ${results.errors.length} 件`, ...results });
  } catch (err) {
    logger.error('importItems error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.getItemOwnerships = async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = { item_id: id, active: true };
    const total = await Ownership.countDocuments(filter);
    const ownerships = await Ownership.find(filter)
      .populate('user_id', 'username qq platform platform_id')
      .populate('source_user_id', 'username qq platform_id')
      .populate('target_user_id', 'username qq platform_id')
      .populate('purchaser_user_id', 'username qq platform platform_id')
      .populate('actual_user_id', 'username qq platform platform_id')
      .populate('points_user_id', 'username qq platform platform_id')
      .sort({ occurred_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();
    return res.json({
      total,
      page: pageNum,
      ownerships: ownerships.map(ownership => ({
        ...ownership,
        item_id: normalizeItem(ownership.item_id)
      }))
    });
  } catch (err) {
    logger.error('getItemOwnerships error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.exportItemOwnerships = async (req, res) => {
  const { id } = req.params;
  try {
    const item = await Item.findById(id).lean();
    if (!item) return res.status(404).json({ message: '商品不存在' });
    const ownerships = await Ownership.find({ item_id: id, active: true })
      .populate('user_id', 'username qq platform platform_id')
      .populate('source_user_id', 'username qq platform_id')
      .populate('target_user_id', 'username qq platform_id')
      .populate('purchaser_user_id', 'username qq platform platform_id')
      .populate('actual_user_id', 'username qq platform platform_id')
      .sort({ occurred_at: -1 })
      .lean();

    const headers = [
      '素材 SKU',
      '素材名称',
      '使用领域',
      '获取途径',
      '用途',
      '购买人 ID',
      '购买人 QQ',
      '实际使用人 ID',
      '实际使用人 QQ',
      '积分',
      '年度消费',
      '发货链接',
      '备注',
      '获取时间'
    ];
    const rows = ownerships.map(ownership => [
      item.sku_code || '',
      item.name || '',
      ownership.usage_field || ownership.identity_role || '',
      ownership.acquisition_method || ownership.acquisition_type,
      ownership.usage_purpose || '',
      ownership.purchaser_display_id || ownership.purchaser_user_id?.platform_id || ownership.purchaser_user_id?.username || '',
      ownership.purchaser_qq || ownership.purchaser_user_id?.qq || '',
      ownership.actual_display_id || ownership.actual_user_id?.platform_id || ownership.actual_user_id?.username || '',
      ownership.actual_qq || ownership.actual_user_id?.qq || '',
      ownership.points_delta ?? 0,
      ownership.annual_spend_delta ?? 0,
      ownership.delivery_link || '',
      ownership.notes || '',
      ownership.occurred_at ? new Date(ownership.occurred_at).toISOString() : ''
    ]);
    const csv = [headers, ...rows].map(row => row.map(escapeCsv).join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="item-${item.sku_code || id}-ownerships.csv"`);
    return res.send(`\uFEFF${csv}`);
  } catch (err) {
    logger.error('exportItemOwnerships error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};

exports.updateItemOwnership = async (req, res) => {
  const { id, ownershipId } = req.params;
  const {
    acquisition_type,
    usage_field,
    acquisition_method,
    usage_purpose,
    points_delta,
    annual_spend_delta,
    delivery_link,
    notes
  } = req.body;
  try {
    const ownership = await Ownership.findOne({ _id: ownershipId, item_id: id, active: true });
    if (!ownership) return res.status(404).json({ message: '授权记录不存在' });

    const updates = {};
    if (acquisition_type !== undefined) {
      const allowedTypes = ['self', 'sponsor', 'sponsored', 'sponsor_pending'];
      if (!allowedTypes.includes(acquisition_type)) {
        return res.status(400).json({ message: '获取类型不支持修改为该值' });
      }
      updates.acquisition_type = acquisition_type;
    }
    if (usage_field !== undefined) {
      const normalized = normalizeUsageField(usage_field);
      if (!normalized) return res.status(400).json({ message: '使用领域不支持该值' });
      updates.usage_field = normalized;
      updates.identity_role = normalized;
    }
    if (acquisition_method !== undefined) {
      const normalized = normalizeAcquisitionMethod(acquisition_method, '');
      if (!normalized) return res.status(400).json({ message: '获取途径不支持该值' });
      updates.acquisition_method = normalized;
    }
    if (usage_purpose !== undefined) {
      const normalized = normalizeUsagePurpose(usage_purpose, '');
      if (!normalized) return res.status(400).json({ message: '用途不支持该值' });
      updates.usage_purpose = normalized;
    }
    const nextMethod = updates.acquisition_method || ownership.acquisition_method;
    const nextPurpose = updates.usage_purpose || ownership.usage_purpose;
    if (nextMethod && nextPurpose && acquisition_type === undefined) {
      updates.acquisition_type = deriveLegacyAcquisitionType(nextMethod, nextPurpose);
    }
    let pointsDeltaChange = 0;
    if (points_delta !== undefined) {
      const nextPoints = Number(points_delta);
      if (Number.isNaN(nextPoints)) return res.status(400).json({ message: '积分不是有效数字' });
      pointsDeltaChange = nextPoints - (Number(ownership.points_delta) || 0);
      updates.points_delta = nextPoints;
    }
    let annualSpendDeltaChange = 0;
    if (annual_spend_delta !== undefined) {
      const nextAnnualSpend = Number(annual_spend_delta);
      if (Number.isNaN(nextAnnualSpend)) return res.status(400).json({ message: '年度消费不是有效数字' });
      annualSpendDeltaChange = nextAnnualSpend - (Number(ownership.annual_spend_delta) || 0);
      updates.annual_spend_delta = nextAnnualSpend;
    }
    if (delivery_link !== undefined) updates.delivery_link = delivery_link;
    if (notes !== undefined) updates.notes = notes;

    const updated = await Ownership.findByIdAndUpdate(ownership._id, updates, { new: true })
      .populate('user_id', 'username qq platform platform_id')
      .populate('source_user_id', 'username qq platform_id')
      .populate('target_user_id', 'username qq platform_id')
      .populate('purchaser_user_id', 'username qq platform platform_id')
      .populate('actual_user_id', 'username qq platform platform_id')
      .lean();

    const accountingUserId = ownership.points_user_id || ownership.user_id;
    if ((pointsDeltaChange !== 0 || annualSpendDeltaChange !== 0) && accountingUserId) {
      await User.findByIdAndUpdate(accountingUserId, {
        $inc: { points_total: pointsDeltaChange, annual_spend: annualSpendDeltaChange }
      });
      await User.updateOne(
        { _id: accountingUserId, points_total: { $lt: 0 } },
        { $set: { points_total: 0 } }
      );
      await User.updateOne(
        { _id: accountingUserId, annual_spend: { $lt: 0 } },
        { $set: { annual_spend: 0 } }
      );
      await syncUserVip(accountingUserId);
    }

    logger.info('Item ownership updated', { itemId: id, ownershipId });
    return res.json({ message: '授权记录已更新', ownership: updated });
  } catch (err) {
    logger.error('updateItemOwnership error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
