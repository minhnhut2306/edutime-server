const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    sparse: true,  // Cho phép nhiều null
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    sparse: true,  // Cho phép nhiều null, bỏ unique: true
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Tạo sparse unique index - cho phép nhiều null nhưng không trùng khi có giá trị
teacherSchema.index({ userId: 1 }, { unique: true, sparse: true });
teacherSchema.index({ phone: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Teacher", teacherSchema);