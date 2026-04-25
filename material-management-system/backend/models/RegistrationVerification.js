const mongoose = require('mongoose');

const registrationVerificationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    code_hash: { type: String, required: true, select: false },
    expires_at: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    last_sent_at: { type: Date, required: true }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

registrationVerificationSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RegistrationVerification', registrationVerificationSchema);
