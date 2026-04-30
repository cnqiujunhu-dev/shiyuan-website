const USAGE_FIELDS = ['文游作者', '小说作者', '非重氪独立游戏作者', '美工'];
const ACQUISITION_METHODS = ['购买', '活动购买', '被赞助', '回购', '会员帮回购', '中奖', '退圈掉落'];
const USAGE_PURPOSES = ['自用', '赞助待定', '赞助确定'];

const USAGE_FIELD_ALIASES = {
  文游: '文游作者',
  文游类: '文游作者',
  美工美化: '美工',
  美工美化类: '美工',
  美化: '美工',
  独立游戏作者: '非重氪独立游戏作者',
  非重氪游戏作者: '非重氪独立游戏作者'
};

const ACQUISITION_METHOD_ALIASES = {
  普通购买: '购买',
  自购: '购买',
  购买自用: '购买',
  活动: '活动购买',
  活动购: '活动购买',
  赞助: '购买',
  已赞助: '购买',
  赞待: '购买',
  赞助待定: '购买',
  赞助确定: '购买',
  被赞: '被赞助',
  自用回购: '回购',
  帮回购: '会员帮回购',
  会员代回购: '会员帮回购',
  抽奖: '中奖',
  掉落: '退圈掉落'
};

const USAGE_PURPOSE_ALIASES = {
  自购: '自用',
  购买自用: '自用',
  赞待: '赞助待定',
  待赞助: '赞助待定',
  已赞助: '赞助确定',
  赞助: '赞助确定',
  帮回购: '自用',
  会员帮回购: '自用'
};

const LEGACY_ACQUISITION_TYPE_LABELS = {
  self: '自用',
  sponsor: '赞助确定',
  sponsored: '被赞助',
  sponsor_pending: '赞助待定',
  transfer_in: '转入',
  transfer_out: '转出'
};

function normalizeEnum(value, aliases, allowed, fallback) {
  const raw = String(value || '').trim();
  const normalized = aliases[raw] || raw || fallback;
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeUsageField(value) {
  return normalizeEnum(value, USAGE_FIELD_ALIASES, USAGE_FIELDS, '');
}

function normalizeAcquisitionMethod(value, fallback = '购买') {
  return normalizeEnum(value, ACQUISITION_METHOD_ALIASES, ACQUISITION_METHODS, fallback);
}

function normalizeUsagePurpose(value, fallback = '自用') {
  return normalizeEnum(value, USAGE_PURPOSE_ALIASES, USAGE_PURPOSES, fallback);
}

function deriveLegacyAcquisitionType(acquisitionMethod, usagePurpose) {
  if (usagePurpose === '赞助待定') return 'sponsor_pending';
  if (usagePurpose === '赞助确定') return 'sponsor';
  if (acquisitionMethod === '被赞助') return 'sponsored';
  return 'self';
}

function hydrateOwnershipCaliber(ownership = {}) {
  const acquisitionType = ownership.acquisition_type;
  const acquisitionMethod = ownership.acquisition_method
    || (acquisitionType === 'sponsored' ? '被赞助' : '购买');
  const usagePurpose = ownership.usage_purpose
    || (acquisitionType === 'sponsor_pending'
      ? '赞助待定'
      : acquisitionType === 'sponsor'
        ? '赞助确定'
        : '自用');
  return {
    usage_field: ownership.usage_field || ownership.identity_role || '',
    acquisition_method: acquisitionMethod,
    usage_purpose: usagePurpose
  };
}

function getRulePoints({ item, acquisitionMethod, usagePurpose }) {
  const price = Number(item?.price) || 0;
  if (acquisitionMethod === '中奖' || acquisitionMethod === '被赞助') return 0;
  if (acquisitionMethod === '活动购买') return price * 2;
  if (['购买', '回购', '会员帮回购', '退圈掉落'].includes(acquisitionMethod)) return price;
  if (usagePurpose === '赞助待定' || usagePurpose === '赞助确定') return price;
  return 0;
}

function getRuleAnnualSpend({ item, acquisitionMethod }) {
  const price = Number(item?.price) || 0;
  if (['购买', '活动购买', '回购', '会员帮回购', '退圈掉落'].includes(acquisitionMethod)) {
    return price;
  }
  return 0;
}

function resolvePointsAndSpend({ item, acquisitionMethod, usagePurpose, pointsValue }) {
  const hasManualPoints = pointsValue !== undefined && pointsValue !== null && String(pointsValue).trim() !== '';
  const manualPoints = hasManualPoints ? Number(pointsValue) : NaN;
  const points = hasManualPoints && Number.isFinite(manualPoints)
    ? manualPoints
    : getRulePoints({ item, acquisitionMethod, usagePurpose });
  return {
    points,
    annualSpend: getRuleAnnualSpend({ item, acquisitionMethod, usagePurpose })
  };
}

function getTransferPoints(ownership, item) {
  const caliber = hydrateOwnershipCaliber(ownership);
  const price = Number(item?.price ?? ownership?.item_id?.price) || 0;
  return caliber.acquisition_method === '活动购买' ? price * 2 : price;
}

function isTransferableOwnership(ownership, user) {
  const caliber = hydrateOwnershipCaliber(ownership);
  return Boolean(
    ownership?.active
    && String(ownership.user_id?._id || ownership.user_id) === String(user?._id || user?.id)
    && ['购买', '活动购买'].includes(caliber.acquisition_method)
    && caliber.usage_purpose === '自用'
    && !ownership.transfer_locked
    && Number(user?.vip_level || 0) >= 2
    && Number(user?.transfer_remaining || 0) > 0
  );
}

function shouldHaveDeliveryLink(acquisitionMethod, usagePurpose) {
  if (usagePurpose === '赞助待定' || usagePurpose === '赞助确定') return false;
  return ['购买', '活动购买', '被赞助', '回购', '会员帮回购', '中奖', '退圈掉落'].includes(acquisitionMethod);
}

function shouldHidePurchaser(acquisitionMethod) {
  return ['会员帮回购', '中奖', '退圈掉落'].includes(acquisitionMethod);
}

function serializeAcquisitionType(type) {
  return LEGACY_ACQUISITION_TYPE_LABELS[type] || type || '';
}

module.exports = {
  USAGE_FIELDS,
  ACQUISITION_METHODS,
  USAGE_PURPOSES,
  normalizeUsageField,
  normalizeAcquisitionMethod,
  normalizeUsagePurpose,
  deriveLegacyAcquisitionType,
  hydrateOwnershipCaliber,
  resolvePointsAndSpend,
  getTransferPoints,
  isTransferableOwnership,
  shouldHaveDeliveryLink,
  shouldHidePurchaser,
  serializeAcquisitionType
};
