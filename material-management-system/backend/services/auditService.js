const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

async function log(actorId, action, entity, entityId, before, after, req) {
  try {
    const ip = req ? (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '') : '';
    const ua = req ? (req.headers['user-agent'] || '') : '';
    await AuditLog.create({
      actor_id: actorId,
      action,
      entity,
      entity_id: entityId,
      before,
      after,
      occurred_at: new Date(),
      ip,
      ua
    });
  } catch (err) {
    logger.error('Audit log error', { message: err.message });
  }
}

module.exports = { log };
