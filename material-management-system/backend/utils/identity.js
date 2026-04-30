const IDENTITY_ROLES = ['文游作者', '小说作者', '非重氪独立游戏作者', '美工'];
const IDENTITY_PLATFORMS = ['全平台', '橙光', '易次元', '闪艺', '晋江', '番茄', '微博', '小红书', '抖音', '快手'];
const ROLE_ALIASES = {
  美工美化: '美工',
  美工美化类: '美工',
  画师: '美工',
  美化: '美工',
  文游: '文游作者',
  作者: '文游作者',
  独立游戏作者: '非重氪独立游戏作者',
  非重氪游戏作者: '非重氪独立游戏作者'
};

function normalizeRole(value) {
  const role = String(value || '').trim();
  return ROLE_ALIASES[role] || role;
}

function normalizePlatform(value) {
  return String(value || '全平台').trim() || '全平台';
}

function normalizeIdentity(input = {}) {
  return {
    role: normalizeRole(input.role || input.identity_role || input.domain || input.field),
    platform: normalizePlatform(input.platform),
    nickname: String(input.nickname || input.platform_id || input.circle_id || input.circle_name || '').trim(),
    uid: String(input.uid || input.writer_uid || input.platform_uid || '').trim()
  };
}

function getIdentityValidationMessage(identity) {
  if (!identity.role) return '请选择职业';
  if (!identity.platform) return '请选择平台';
  if (!identity.nickname) return '请输入圈名';
  if (!IDENTITY_ROLES.includes(identity.role)) return '职业仅支持文游作者、小说作者、非重氪独立游戏作者、美工';
  if (!IDENTITY_PLATFORMS.includes(identity.platform)) return '平台选项不支持';
  if (identity.role.length > 30) return '职业长度不能超过 30 个字符';
  if (identity.platform.length > 30) return '平台长度不能超过 30 个字符';
  if (identity.nickname.length > 50) return '圈名长度不能超过 50 个字符';
  if (identity.uid.length > 50) return 'UID 长度不能超过 50 个字符';
  if (identity.role === '文游作者' && !identity.uid) return '文游作者请填写 UID';
  if (/[<>\r\n\t]/.test(`${identity.role}${identity.platform}${identity.nickname}${identity.uid}`)) {
    return '身份信息不能包含换行、制表符或尖括号';
  }
  return null;
}

function normalizeIdentities(input) {
  const source = Array.isArray(input) ? input : [input];
  return source
    .map(normalizeIdentity)
    .filter(identity => identity.role || identity.platform || identity.nickname || identity.uid);
}

function buildLegacyIdentity(user = {}) {
  if (!user.platform && !user.platform_id) return null;
  return {
    role: '未填写',
    platform: user.platform || '未填写',
    nickname: user.platform_id || '未填写',
    uid: '',
    is_primary: true,
    status: user.registration_status === 'pending' ? 'pending' : 'approved',
    submitted_at: user.created_at
  };
}

function plainIdentity(identity) {
  return identity?.toObject ? identity.toObject() : identity;
}

function getActiveIdentities(user = {}) {
  const identities = Array.isArray(user.identities) ? user.identities.map(plainIdentity) : [];
  return identities.filter(identity => identity && identity.status !== 'rejected');
}

function getPrimaryIdentity(user = {}) {
  const identities = getActiveIdentities(user);
  if (identities.length === 0) return null;
  if (identities.length === 1) return identities[0];
  return identities.find(identity => identity.is_primary && identity.status === 'approved')
    || identities.find(identity => identity.is_primary)
    || identities.find(identity => identity.status === 'approved')
    || identities[0];
}

function getPreferredRoleByMaterialDomain(materialDomain) {
  if (materialDomain === '文游类') return '文游作者';
  if (materialDomain === '美工美化类') return '美工';
  return '';
}

function selectIdentityForMaterial(user = {}, materialDomain = '') {
  const identities = getActiveIdentities(user);
  if (identities.length === 0) return null;
  if (identities.length === 1) return identities[0];

  const preferredRole = getPreferredRoleByMaterialDomain(materialDomain);
  if (preferredRole) {
    return identities.find(identity => identity.role === preferredRole && identity.status === 'approved')
      || identities.find(identity => identity.role === preferredRole)
      || getPrimaryIdentity(user);
  }
  return getPrimaryIdentity(user);
}

function buildOwnershipIdentityFields(identityDoc) {
  const identity = plainIdentity(identityDoc);
  if (!identity) return {};
  return {
    identity_id: identity._id,
    identity_role: identity.role,
    identity_nickname: identity.nickname,
    identity_uid: identity.uid || ''
  };
}

function serializeIdentities(user = {}) {
  const identities = Array.isArray(user.identities)
    ? user.identities.map((identity) => {
      const plain = identity.toObject ? identity.toObject() : identity;
      return {
        ...plain,
        id: String(plain._id || plain.id || '')
      };
    })
    : [];

  if (identities.length > 0) return identities;

  const legacyIdentity = buildLegacyIdentity(user);
  return legacyIdentity ? [legacyIdentity] : [];
}

module.exports = {
  IDENTITY_ROLES,
  IDENTITY_PLATFORMS,
  normalizeIdentity,
  normalizeIdentities,
  getIdentityValidationMessage,
  getPrimaryIdentity,
  selectIdentityForMaterial,
  buildOwnershipIdentityFields,
  serializeIdentities
};
