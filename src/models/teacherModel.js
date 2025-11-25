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
  schoolYear: {
    type: String,
    required: true,
    match: /^\d{4}-\d{4}$/,
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active',
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

teacherSchema.index({ userId: 1 }, { unique: true, sparse: true });
teacherSchema.index({ phone: 1, schoolYear: 1 }, { unique: true, sparse: true });
teacherSchema.index({ schoolYear: 1, status: 1 });

module.exports = mongoose.model("Teacher", teacherSchema);