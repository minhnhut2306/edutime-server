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
});

weekSchema.index({ weekNumber: 1, schoolYearId: 1 }, { unique: true });
weekSchema.index({ schoolYearId: 1, status: 1 });

module.exports = mongoose.model("Week", weekSchema);
