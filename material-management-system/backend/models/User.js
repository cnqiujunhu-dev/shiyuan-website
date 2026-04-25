const mongoose = require('mongoose');
const crypto = require('crypto');

async function generateUid(UserModel, currentId) {
  for (let i = 0; i < 8; i++) {
    const uid = `UID${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const exists = await UserModel.exists({ uid, _id: { $ne: currentId } });
    if (!exists) return uid;
  }
  throw new Error('无法生成唯一 UID');
}

const userSchema = new mongoose.Schema(
  {
    uid: { type: String, trim: true },
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
    registration_status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved'
    },
    registration_reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    registration_reviewed_at: { type: Date },
    registration_reject_reason: { type: String },
    platform_changed_at: { type: Date } // legacy, kept for existing data
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

userSchema.pre('validate', async function assignUid(next) {
  try {
    if (!this.uid) {
      this.uid = await generateUid(this.constructor, this._id);
    }
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.index({ uid: 1 }, { unique: true, sparse: true });
userSchema.index({ qq: 1 }, { sparse: true });
userSchema.index({ platform: 1, platform_id: 1 }, { sparse: true });
userSchema.index({ vip_level: 1 });
userSchema.index({ registration_status: 1, created_at: -1 });

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
