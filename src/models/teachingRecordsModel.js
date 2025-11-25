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
    index: true, // ✅ Đã có
  },
  recordType: {
    type: String,
    enum: ['teaching', 'tn-hn1', 'tn-hn2', 'tn-hn3', 'extra', 'exam'],
    default: 'teaching',
  },
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