const Item = require('../models/Item');
const logger = require('../config/logger');

exports.getShopItems = async (req, res) => {
  const { topic, artist, page = 1, limit = 20 } = req.query;
  try {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const filter = { status: 'on_sale' };
    if (topic) filter.categories = topic;
    if (artist) filter.artist = new RegExp(artist, 'i');
    const total = await Item.countDocuments(filter);
    const items = await Item.find(filter)
      .select('-delivery_link')
      .sort({ created_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();
    return res.json({ total, page: pageNum, items });
  } catch (err) {
    logger.error('getShopItems error', { message: err.message });
    return res.status(500).json({ message: '服务器错误' });
  }
};
