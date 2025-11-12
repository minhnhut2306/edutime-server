// src/models/schoolYear.model.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const schoolYearSchema = new Schema(
  {
    year: {
      type: String,
      required: [true, 'Vui lòng cung cấp năm học'],
      unique: true,
      match: [/^\d{4}-\d{4}$/, 'Định dạng năm học không hợp lệ (VD: 2024-2025)']
    },
    teachers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Teacher'
      }
    ],
    classes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Class'
      }
    ],
    subjects: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Subject'
      }
    ],
    weeks: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Week'
      }
    ],
    teachingRecords: [
      {
        type: Schema.Types.ObjectId,
        ref: 'TeachingRecord'
      }
    ],
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active'
    },
    endedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Indexes
schoolYearSchema.index({ year: 1 });
schoolYearSchema.index({ status: 1 });

module.exports = mongoose.model('SchoolYear', schoolYearSchema);