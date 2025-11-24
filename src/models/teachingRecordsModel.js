const mongoose = require("mongoose");

const teachingRecordsSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true,
    index: true,
  },
  weekId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Week",
    required: true,
    index: true,
  },
  subjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  },
  periods: {
    type: Number,
    required: true,
    min: 1,
    max: 20,
  },
  schoolYear: {
    type: String,
    required: true,
    match: /^\d{4}-\d{4}$/,
  },
  // Thêm các loại tiết dạy mới
  recordType: {
    type: String,
    enum: ['teaching', 'tn-hn1', 'tn-hn2', 'tn-hn3', 'extra', 'exam'],
    default: 'teaching',
    // teaching: Giảng dạy thông thường (Khối 10, 11, 12)
    // tn-hn1: Trung học - Hướng nghiệp 1
    // tn-hn2: Trung học - Hướng nghiệp 2
    // tn-hn3: Trung học - Hướng nghiệp 3
    // extra: Kiêm nhiệm
    // exam: Coi thi
  },
  // Ghi chú cho từng loại
  notes: {
    type: String,
    default: '',
  },
  createdBy: {
    type: String,
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

teachingRecordsSchema.index({ teacherId: 1, weekId: 1 });
teachingRecordsSchema.index({ schoolYear: 1, teacherId: 1 });
teachingRecordsSchema.index({ recordType: 1 });

module.exports = mongoose.model("TeachingRecords", teachingRecordsSchema);