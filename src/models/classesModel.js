const mongoose = require("mongoose");

const classesSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    grade: {
        type: String,
        required: true,

    },
    studentCount: {
        type: Number,
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

module.exports = mongoose.model("Class", classesSchema);