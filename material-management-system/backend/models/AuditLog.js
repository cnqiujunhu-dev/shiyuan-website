const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String },
  entity: { type: String },
  entity_id: { type: mongoose.Schema.Types.ObjectId },
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },
  occurred_at: { type: Date, default: Date.now },
  ip: { type: String },
  ua: { type: String }
});

module.exports = mongoose.model('AuditLog', auditLogSchema);
