const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    sparse: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    sparse: true,
  },
  subjectIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Subject",
    required: true,
  },
  mainClassId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  },
  schoolYearId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SchoolYear",
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ["active", "archived"],
    default: "active",
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// ✅ Index tổng hợp để query hiệu quả
teacherSchema.index({ userId: 1 }, { unique: true, sparse: true });
teacherSchema.index({ phone: 1, schoolYearId: 1 }, { unique: true, sparse: true });
teacherSchema.index({ schoolYearId: 1, status: 1 });

module.exports = mongoose.model("Teacher", teacherSchema);
