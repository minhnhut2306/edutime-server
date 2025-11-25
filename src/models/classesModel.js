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

classesSchema.index({ name: 1, schoolYear: 1 }, { unique: true });
classesSchema.index({ schoolYear: 1, status: 1 });

module.exports = mongoose.model("Class", classesSchema);