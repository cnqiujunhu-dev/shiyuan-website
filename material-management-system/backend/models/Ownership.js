const mongoose = require('mongoose');

const ownershipSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    acquisition_type: {
      type: String,
      enum: ['self', 'sponsor', 'sponsored', 'sponsor_pending', 'transfer_in', 'transfer_out'],
      required: true
    },
    usage_field: {
      type: String,
      enum: ['文游作者', '小说作者', '非重氪独立游戏作者', '美工', ''],
      default: ''
    },
    acquisition_method: {
      type: String,
      enum: ['购买', '活动购买', '被赞助', '回购', '会员帮回购', '中奖', '退圈掉落', ''],
      default: ''
    },
    usage_purpose: {
      type: String,
      enum: ['自用', '赞助待定', '赞助确定', ''],
      default: ''
    },
    purchaser_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    purchaser_display_id: { type: String, trim: true },
    purchaser_qq: { type: String, trim: true },
    actual_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actual_display_id: { type: String, trim: true },
    actual_qq: { type: String, trim: true },
    points_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    points_delta: { type: Number, required: true },
    annual_spend_delta: { type: Number, default: 0 },
    occurred_at: { type: Date, required: true },
    delivery_link: { type: String },
    hide_purchaser_publicly: { type: Boolean, default: false },
    source_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    target_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    source_ownership_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ownership' },
    related_ownership_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ownership' },
    identity_id: { type: mongoose.Schema.Types.ObjectId },
    identity_role: { type: String, trim: true },
    identity_nickname: { type: String, trim: true },
    identity_uid: { type: String, trim: true },
    notes: { type: String, trim: true },
    replaced_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Ownership' },
    transfer_locked: { type: Boolean, default: false },
    transfer_locked_reason: { type: String },
    active: { type: Boolean, default: true }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

ownershipSchema.index({ user_id: 1, occurred_at: -1 });
ownershipSchema.index({ user_id: 1, active: 1, acquisition_type: 1 });
ownershipSchema.index({ actual_user_id: 1, active: 1, occurred_at: -1 });
ownershipSchema.index({ purchaser_user_id: 1, occurred_at: -1 });
ownershipSchema.index({ actual_qq: 1 });
ownershipSchema.index({ actual_display_id: 1 });
ownershipSchema.index({ item_id: 1, active: 1 });

module.exports = mongoose.model('Ownership', ownershipSchema);
