const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    deviceInfo: {
      userAgent: String,
      ip: String,
      browser: String,
      browserVersion: String,
      os: String,
      osVersion: String,
      device: String,
      fingerprint: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deactivatedAt: {
      type: Date,
    },
    deactivatedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

tokenSchema.index({ userId: 1, isActive: 1 });
tokenSchema.index({ token: 1 });
tokenSchema.index({ expiresAt: 1 });
tokenSchema.index({ 'deviceInfo.fingerprint': 1 });

tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Token = mongoose.model("Token", tokenSchema);

module.exports = Token;