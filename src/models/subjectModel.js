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

subjectSchema.index({ name: 1, schoolYear: 1 }, { unique: true });
subjectSchema.index({ schoolYear: 1, status: 1 });

module.exports = mongoose.model("Subject", subjectSchema);