const mongoose = require("mongoose");

const classesSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  grade: {
    type: String,
    required: true,
  },
  studentCount: {
    type: Number,
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

// ✅ Lớp phải unique trong cùng 1 năm học
classesSchema.index({ name: 1, schoolYearId: 1 }, { unique: true });
classesSchema.index({ schoolYearId: 1, status: 1 });

module.exports = mongoose.model("Class", classesSchema);
