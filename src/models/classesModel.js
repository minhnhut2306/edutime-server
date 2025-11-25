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

// ✅ Lớp phải unique trong cùng 1 năm học
classesSchema.index({ name: 1, schoolYear: 1 }, { unique: true });
classesSchema.index({ schoolYear: 1, status: 1 }); // ✅ Quan trọng!

module.exports = mongoose.model("Class", classesSchema);