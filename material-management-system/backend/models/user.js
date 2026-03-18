const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password_hash: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    email_verified_at: { type: Date, default: null },
    email_verify_code: { type: String, select: false },
    email_verify_expires: { type: Date },
    password_reset_code: { type: String, select: false },
    password_reset_expires: { type: Date },
    qq: { type: String },
    platform: { type: String, enum: ['易次元', '橙光', '闪艺'] },
    platform_id: { type: String },
    roles: { type: [String], default: ['user'] },
    vip_level: { type: Number, default: 0 },
    points_total: { type: Number, default: 0 },
    annual_spend: { type: Number, default: 0 },
    transfer_remaining: { type: Number, default: 0 },
    buyback_remaining: { type: Number, default: 0 },
    skip_queue_remaining: { type: Number, default: 0 },
    platform_changed_at: { type: Date } // legacy, kept for existing data
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

userSchema.index({ qq: 1 }, { sparse: true });
userSchema.index({ platform: 1, platform_id: 1 }, { sparse: true });
userSchema.index({ vip_level: 1 });

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password_hash;
    delete ret.email_verify_code;
    delete ret.email_verify_expires;
    delete ret.password_reset_code;
    delete ret.password_reset_expires;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
