/**
 * Service: teachingRecords.service.js
 * Contains getAllTeachingRecords, getTeachingRecordsByTeacher, createTeachingRecord, deleteTeachingRecord
 */

const TeachingRecords = require("../models/teachingRecordsModel");
const Teacher = require("../models/teacherModel");
const Week = require("../models/weekModel");
const Subject = require("../models/subjectModel");
const Class = require("../models/classesModel");

// Lấy tất cả teaching records (cho admin)
// DEBUG version of getAllTeachingRecords
const mongoose = require('mongoose');

const getAllTeachingRecords = async () => {
  try {
    console.log('DEBUG getAllTeachingRecords - mongoose.connection.host:', mongoose.connection.host);
    console.log('DEBUG getAllTeachingRecords - mongoose.connection.name:', mongoose.connection.name);
    console.log('DEBUG getAllTeachingRecords - readyState:', mongoose.connection.readyState);
    // count documents raw (no populate)
    const totalRaw = await TeachingRecords.countDocuments({});
    console.log('DEBUG getAllTeachingRecords - countDocuments:', totalRaw);

    // try find raw documents (no populate) to make sure find() returns items
    const rawRecords = await TeachingRecords.find({}).sort({ createdAt: -1 }).limit(5).lean();
    console.log('DEBUG getAllTeachingRecords - rawRecords sample length:', rawRecords.length);
    if (rawRecords.length > 0) {
      console.log('DEBUG sample rawRecords[0]:', JSON.stringify(rawRecords[0], null, 2));
    }

    // now run original query with populate
    const records = await TeachingRecords.find({})
      .populate("weekId", "weekNumber startDate endDate schoolYear")
      .populate("subjectId", "name code")
      .populate("classId", "name grade")
      .sort({ createdAt: -1 });

    console.log('DEBUG getAllTeachingRecords - populated records length:', records.length);
    return { success: true, data: records };
  } catch (err) {
    console.error('ERROR getAllTeachingRecords:', err);
    return { success: false, message: err.message };
  }
};

// Lấy teaching records theo giáo viên
const getTeachingRecordsByTeacher = async (teacherId) => {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return { success: false, statusCode: 404, message: "Không tìm thấy giáo viên" };
    }
    const records = await TeachingRecords.find({ teacherId })
      .populate("weekId", "weekNumber startDate endDate schoolYear")
      .populate("subjectId", "name code")
      .populate("classId", "name grade")
      .sort({ createdAt: -1 });

    return { success: true, data: records, total: records.length };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

// Thêm teaching record
const createTeachingRecord = async (data) => {
  try {
    const { teacherId, weekId, subjectId, classId, periods, schoolYear, createdBy } = data;

    const [teacher, week, subject, classData, existingRecord] = await Promise.all([
      Teacher.findById(teacherId),
      Week.findById(weekId),
      Subject.findById(subjectId),
      Class.findById(classId),
      TeachingRecords.findOne({ teacherId, weekId, subjectId, classId }),
    ]);

    if (!teacher) {
      return { success: false, statusCode: 404, message: "Không tìm thấy giáo viên" };
    }
    if (!week) {
      return { success: false, statusCode: 404, message: "Không tìm thấy tuần học" };
    }
    if (!subject) {
      return { success: false, statusCode: 404, message: "Không tìm thấy môn học" };
    }
    if (!classData) {
      return { success: false, statusCode: 404, message: "Không tìm thấy lớp học" };
    }
    if (
      teacher.allowedGrades &&
      teacher.allowedGrades.length > 0 &&
      !teacher.allowedGrades.includes(classData.grade)
    ) {
      return {
        success: false,
        statusCode: 403,
        message: `Bạn không có quyền dạy khối ${classData.grade}. Chỉ được dạy khối: ${teacher.allowedGrades.join(", ")}`,
      };
    }
    if (existingRecord) {
      return {
        success: false,
        statusCode: 409,
        message: "Bản ghi này đã tồn tại (cùng tuần, môn học và lớp)",
      };
    }
    const newRecord = await TeachingRecords.create({
      teacherId,
      weekId,
      subjectId,
      classId,
      periods,
      schoolYear,
      createdBy,
    });

    const populatedRecord = await TeachingRecords.findById(newRecord._id)
      .populate("weekId", "weekNumber startDate endDate schoolYear")
      .populate("subjectId", "name code")
      .populate("classId", "name grade");

    return { success: true, data: populatedRecord };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

const updateTeachingRecord = async (recordId, data, currentTeacherId) => {
  try {
    const { teacherId, weekId, subjectId, classId, periods, schoolYear } = data;

    const record = await TeachingRecords.findById(recordId);
    if (!record) {
      return { success: false, statusCode: 404, message: "Không tìm thấy bản ghi" };
    }

    // If non-admin (currentTeacherId provided) ensure owner
    if (currentTeacherId) {
      if (record.teacherId.toString() !== currentTeacherId.toString()) {
        return { success: false, statusCode: 403, message: "Bạn chỉ có quyền sửa bản ghi của chính mình" };
      }
    }

    // Validate provided fields (if provided)
    if (periods !== undefined && (periods < 1 || periods > 20)) {
      return { success: false, statusCode: 400, message: "Số tiết phải từ 1 đến 20" };
    }
    if (schoolYear !== undefined) {
      const schoolYearRegex = /^\d{4}-\d{4}$/;
      if (!schoolYearRegex.test(schoolYear)) {
        return { success: false, statusCode: 400, message: "Năm học không đúng định dạng (VD: 2024-2025)" };
      }
    }

    // If teacherId changed or given, check teacher existence
    const targetTeacherId = teacherId || record.teacherId;
    const teacher = await Teacher.findById(targetTeacherId);
    if (!teacher) {
      return { success: false, statusCode: 404, message: "Không tìm thấy giáo viên" };
    }

    // If classId provided, check class and allowedGrades
    const targetClassId = classId || record.classId;
    const classData = await Class.findById(targetClassId);
    if (!classData) {
      return { success: false, statusCode: 404, message: "Không tìm thấy lớp học" };
    }
    if (
      teacher.allowedGrades &&
      teacher.allowedGrades.length > 0 &&
      !teacher.allowedGrades.includes(classData.grade)
    ) {
      return {
        success: false,
        statusCode: 403,
        message: `Bạn không có quyền dạy khối ${classData.grade}. Chỉ được dạy khối: ${teacher.allowedGrades.join(", ")}`,
      };
    }

    // If week/subject provided, check their existence
    if (weekId) {
      const week = await Week.findById(weekId);
      if (!week) return { success: false, statusCode: 404, message: "Không tìm thấy tuần học" };
    }
    if (subjectId) {
      const subject = await Subject.findById(subjectId);
      if (!subject) return { success: false, statusCode: 404, message: "Không tìm thấy môn học" };
    }

    // Prevent duplicate: ensure no other record (not this one) with same teacher/week/subject/class
    const existing = await TeachingRecords.findOne({
      _id: { $ne: recordId },
      teacherId: teacherId || record.teacherId,
      weekId: weekId || record.weekId,
      subjectId: subjectId || record.subjectId,
      classId: classId || record.classId,
    });
    if (existing) {
      return { success: false, statusCode: 409, message: "Đã tồn tại bản ghi với cùng tuần, môn và lớp" };
    }

    // Apply updates
    if (teacherId) record.teacherId = teacherId;
    if (weekId) record.weekId = weekId;
    if (subjectId) record.subjectId = subjectId;
    if (classId) record.classId = classId;
    if (periods !== undefined) record.periods = periods;
    if (schoolYear) record.schoolYear = schoolYear;

    await record.save();

    const populatedRecord = await TeachingRecords.findById(record._id)
      .populate("weekId", "weekNumber startDate endDate schoolYear")
      .populate("subjectId", "name code")
      .populate("classId", "name grade");

    return { success: true, data: populatedRecord };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

// Xóa teaching record (admin hoặc owner)
// Nếu currentTeacherId === null => xem là admin (cho phép xóa)
const deleteTeachingRecord = async (recordId, currentTeacherId) => {
  try {
    const record = await TeachingRecords.findById(recordId);
    if (!record) {
      return { success: false, statusCode: 404, message: "Không tìm thấy bản ghi" };
    }
    // Nếu currentTeacherId được truyền (non-admin) thì phải trùng với record.teacherId
    if (currentTeacherId) {
      if (record.teacherId.toString() !== currentTeacherId.toString()) {
        return { success: false, statusCode: 403, message: "Bạn chỉ có thể xóa bản ghi của chính mình" };
      }
    }
    // Nếu currentTeacherId là null => admin, cho phép xóa
    await TeachingRecords.findByIdAndDelete(recordId);
    return { success: true, data: { deletedId: recordId } };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

module.exports = {
  getAllTeachingRecords,
  getTeachingRecordsByTeacher,
  createTeachingRecord,
  updateTeachingRecord,
  deleteTeachingRecord,
};