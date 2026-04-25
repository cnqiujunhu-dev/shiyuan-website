function normalizePublicUrl(value) {
  if (!value) return value;
  const normalized = String(value).trim().replace(/\\/g, '/');
  if (!normalized) return normalized;
  if (/^(https?:|data:|blob:|\/)/i.test(normalized)) return normalized;
  return `/${normalized.replace(/^\.?\//, '')}`;
}

function normalizeItem(item) {
  if (!item) return item;
  const output = typeof item.toObject === 'function' ? item.toObject() : { ...item };
  output.preview_url = normalizePublicUrl(output.preview_url);
  return output;
}

module.exports = { normalizePublicUrl, normalizeItem };
