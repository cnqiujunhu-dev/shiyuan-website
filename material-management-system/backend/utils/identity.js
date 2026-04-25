function normalizeIdentity(input = {}) {
  return {
    role: String(input.role || input.identity_role || '').trim(),
    platform: String(input.platform || '').trim(),
    nickname: String(input.nickname || input.platform_id || input.circle_name || '').trim()
  };
}

function getIdentityValidationMessage(identity) {
  if (!identity.role) return '请选择职业';
  if (!identity.platform) return '请选择平台';
  if (!identity.nickname) return '请输入圈名';
  if (identity.role.length > 30) return '职业长度不能超过 30 个字符';
  if (identity.platform.length > 30) return '平台长度不能超过 30 个字符';
  if (identity.nickname.length > 50) return '圈名长度不能超过 50 个字符';
  if (/[<>\r\n\t]/.test(`${identity.role}${identity.platform}${identity.nickname}`)) {
    return '身份信息不能包含换行、制表符或尖括号';
  }
  return null;
}

function buildLegacyIdentity(user = {}) {
  if (!user.platform && !user.platform_id) return null;
  return {
    role: '未填写',
    platform: user.platform || '未填写',
    nickname: user.platform_id || '未填写',
    is_primary: true,
    status: user.registration_status === 'pending' ? 'pending' : 'approved',
    submitted_at: user.created_at
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
  normalizeIdentity,
  getIdentityValidationMessage,
  serializeIdentities
};
