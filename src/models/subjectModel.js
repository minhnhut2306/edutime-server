const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema({
    name: {
        type: String,
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
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// ✅ Môn học phải unique trong cùng 1 năm học
subjectSchema.index({ name: 1, schoolYear: 1 }, { unique: true });
subjectSchema.index({ schoolYear: 1, status: 1 }); // ✅ Quan trọng!

module.exports = mongoose.model("Subject", subjectSchema);
