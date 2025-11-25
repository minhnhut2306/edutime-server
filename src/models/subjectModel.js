const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    schoolYearId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SchoolYear',
        required: true,
        index: true,
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

classesSchema.index({ name: 1, schoolYearId: 1 }, { unique: true });
classesSchema.index({ schoolYearId: 1, status: 1 });

module.exports = mongoose.model("Subject", subjectSchema);
