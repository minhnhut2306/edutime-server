const mongoose = require("mongoose");

const weekSchema = new mongoose.Schema({
    weekNumber: {
        type: Number,
        required: true,
    },
    startDate: {
        type: Date,
        required: true,
    },
    endDate: {
        type: Date,
        required: true,
    },
    schoolYear: {
        type: String,
        required: true,
        match: /^\d{4}-\d{4}$/,
        index: true, // ✅ Thêm index
    },
    status: {
        type: String,
        enum: ['active', 'archived'],
        default: 'active',
        index: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// ✅ Tuần phải unique trong cùng 1 năm học
weekSchema.index({ weekNumber: 1, schoolYear: 1 }, { unique: true });
weekSchema.index({ schoolYear: 1, status: 1 }); // ✅ Quan trọng!

module.exports = mongoose.model("Week", weekSchema);
