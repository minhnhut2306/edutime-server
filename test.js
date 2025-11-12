const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    phone: {
        type: String,
        required: true,
        unique: true,
    },
    role: {
        type: String,
        enum: ["admin", "user"],
        default: "user",
    },
    status: {
        type: String,
        enum: ["active", "inactive"],
        default: "active",
    },
    allowedGrades: {
        type: [String],
        default: [],
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

module.exports = mongoose.model("User", userSchema);

const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema({
   userIds: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
   },
   subjectIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Subject",
    required: true,
   },
   mainClassId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
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

module.exports = mongoose.model("Teacher", teacherSchema);
const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
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

module.exports = mongoose.model("Subject", subjectSchema);
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
const mongoose = require("mongoose");

const teachingrecordsSchema = new mongoose.Schema({
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Teacher",
        required: true,
    },
    weekId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Week",
        required: true,
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
    periods:{
        type: [Number],
        required: true,
    },
    schoolYear:{
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

module.exports = mongoose.model("TeachingRecords", teachingrecordsSchema);

const mongoose = require("mongoose");

const weekSchema = new mongoose.Schema({
    weekNumber: {
        type: Number,
        required: true,
    },
    weekStartDate: {
        type: Date,
        required: true,
    },
    weekEndDate: {
        type: Date,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model("Week", weekSchema);