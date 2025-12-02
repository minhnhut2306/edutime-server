const mongoose = require("mongoose");
const TeachingRecords = require("../models/teachingRecordsModel");
const Teacher = require("../models/teacherModel");
const Week = require("../models/weekModel");
const Subject = require("../models/subjectModel");
const Class = require("../models/classesModel");

const populateFields = [
  { path: "teacherId", select: "name phone" },
  { path: "weekId", select: "weekNumber startDate endDate schoolYearId" },
  { path: "subjectId", select: "name code" },
  { path: "classId", select: "name grade studentCount" }
];

const getAllTeachingRecords = async (schoolYearId = null) => {
  try {
    const query = {};
    if (schoolYearId) query.schoolYearId = schoolYearId;
    const records = await TeachingRecords.find(query)
      .populate(populateFields)
      .sort({ createdAt: -1 });
    return { success: true, data: records };
  } catch (err) {
    console.error("teachingRecordsService.getAllTeachingRecords error:", err);
    return { success: false, statusCode: 500, message: "Có lỗi khi lấy dữ liệu bản ghi" };
  }
};

const getTeachingRecordsByTeacher = async (teacherId, schoolYearId = null) => {
  try {
    if (!teacherId) return { success: true, data: [], total: 0 };
    if (!mongoose.Types.ObjectId.isValid(String(teacherId))) {
      return { success: false, statusCode: 400, message: "Thông tin giáo viên không hợp lệ" };
    }
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return { success: false, statusCode: 404, message: "Không tìm thấy giáo viên. Vui lòng kiểm tra lại." };
    }
    const query = { teacherId };
    if (schoolYearId) query.schoolYearId = schoolYearId;
    const records = await TeachingRecords.find(query)
      .populate(populateFields)
      .sort({ createdAt: -1 });
    return { success: true, data: records, total: records.length };
  } catch (err) {
    console.error("teachingRecordsService.getTeachingRecordsByTeacher error:", err);
    return { success: false, statusCode: 500, message: "Có lỗi khi lấy dữ liệu bản ghi" };
  }
};

const createTeachingRecord = async (data) => {
  try {
    const {
      teacherId,
      weekId,
      subjectId,
      classId,
      periods,
      schoolYearId,
      createdBy,
      recordType,
      notes,
    } = data;

    if (!teacherId || !weekId || !subjectId || !classId || periods === undefined || !schoolYearId) {
      return { success: false, statusCode: 400, message: "Thiếu thông tin bắt buộc. Vui lòng kiểm tra lại." };
    }

    if (!mongoose.Types.ObjectId.isValid(String(teacherId))) {
      return { success: false, statusCode: 400, message: "Thông tin giáo viên không hợp lệ" };
    }

    const [teacher, week, subject, classData, existingRecord] = await Promise.all([
      Teacher.findById(teacherId),
      Week.findById(weekId),
      Subject.findById(subjectId),
      Class.findById(classId),
      TeachingRecords.findOne({ teacherId, weekId, subjectId, classId }),
    ]);

    if (!teacher) return { success: false, statusCode: 404, message: "Không tìm thấy giáo viên. Vui lòng kiểm tra lại." };
    if (!week) return { success: false, statusCode: 404, message: "Không tìm thấy tuần học. Vui lòng kiểm tra lại." };
    if (!subject) return { success: false, statusCode: 404, message: "Không tìm thấy môn học. Vui lòng kiểm tra lại." };
    if (!classData) return { success: false, statusCode: 404, message: "Không tìm thấy lớp học. Vui lòng kiểm tra lại." };
    if (periods < 1 || periods > 20) return { success: false, statusCode: 400, message: "Số tiết phải từ 1 đến 20" };

    if (Array.isArray(teacher.allowedGrades) && teacher.allowedGrades.length > 0 && !teacher.allowedGrades.includes(classData.grade)) {
      return { success: false, statusCode: 403, message: `Bạn không có quyền dạy khối ${classData.grade}.` };
    }

    if (existingRecord) {
      return { success: false, statusCode: 409, message: "Bản ghi đã tồn tại cho cùng tuần, môn và lớp" };
    }

    const newRecord = await TeachingRecords.create({
      teacherId,
      weekId,
      subjectId,
      classId,
      periods,
      schoolYearId,
      createdBy,
      recordType: recordType || "teaching",
      notes: notes || "",
    });

    const populated = await TeachingRecords.findById(newRecord._id).populate(populateFields);
    return { success: true, data: populated };
  } catch (err) {
    console.error("teachingRecordsService.createTeachingRecord error:", err);
    return { success: false, statusCode: 500, message: "Có lỗi khi thêm bản ghi. Vui lòng thử lại." };
  }
};

const updateTeachingRecord = async (recordId, data, currentTeacherId) => {
  try {
    if (!recordId || !mongoose.Types.ObjectId.isValid(String(recordId))) {
      return { success: false, statusCode: 400, message: "Thông tin bản ghi không hợp lệ" };
    }

    const {
      teacherId,
      weekId,
      subjectId,
      classId,
      periods,
      schoolYearId,
      recordType,
      notes,
    } = data;

    const record = await TeachingRecords.findById(recordId);
    if (!record) return { success: false, statusCode: 404, message: "Không tìm thấy bản ghi" };

    if (currentTeacherId) {
      if (record.teacherId.toString() !== String(currentTeacherId)) {
        return { success: false, statusCode: 403, message: "Bạn chỉ có quyền sửa bản ghi của chính mình" };
      }
    }

    if (periods !== undefined && (periods < 1 || periods > 20)) {
      return { success: false, statusCode: 400, message: "Số tiết phải từ 1 đến 20" };
    }

    const targetTeacherId = teacherId || record.teacherId;
    if (!mongoose.Types.ObjectId.isValid(String(targetTeacherId))) {
      return { success: false, statusCode: 400, message: "Thông tin giáo viên không hợp lệ" };
    }

    const teacher = await Teacher.findById(targetTeacherId);
    if (!teacher) return { success: false, statusCode: 404, message: "Không tìm thấy giáo viên" };

    const targetClassId = classId || record.classId;
    const classData = await Class.findById(targetClassId);
    if (!classData) return { success: false, statusCode: 404, message: "Không tìm thấy lớp học" };

    if (Array.isArray(teacher.allowedGrades) && teacher.allowedGrades.length > 0 && !teacher.allowedGrades.includes(classData.grade)) {
      return { success: false, statusCode: 403, message: `Bạn không có quyền dạy khối ${classData.grade}.` };
    }

    if (weekId) {
      const week = await Week.findById(weekId);
      if (!week) return { success: false, statusCode: 404, message: "Không tìm thấy tuần học" };
    }

    if (subjectId) {
      const subject = await Subject.findById(subjectId);
      if (!subject) return { success: false, statusCode: 404, message: "Không tìm thấy môn học" };
    }

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

    if (teacherId) record.teacherId = teacherId;
    if (weekId) record.weekId = weekId;
    if (subjectId) record.subjectId = subjectId;
    if (classId) record.classId = classId;
    if (periods !== undefined) record.periods = periods;
    if (schoolYearId) record.schoolYearId = schoolYearId;
    if (recordType !== undefined) record.recordType = recordType;
    if (notes !== undefined) record.notes = notes;

    record.updatedAt = new Date();
    await record.save();

    const populated = await TeachingRecords.findById(record._id).populate(populateFields);
    return { success: true, data: populated };
  } catch (err) {
    console.error("teachingRecordsService.updateTeachingRecord error:", err);
    return { success: false, statusCode: 500, message: "Có lỗi khi cập nhật bản ghi. Vui lòng thử lại." };
  }
};

const deleteTeachingRecord = async (recordId, currentTeacherId) => {
  try {
    if (!recordId || !mongoose.Types.ObjectId.isValid(String(recordId))) {
      return { success: false, statusCode: 400, message: "Thông tin bản ghi không hợp lệ" };
    }
    const record = await TeachingRecords.findById(recordId);
    if (!record) return { success: false, statusCode: 404, message: "Không tìm thấy bản ghi" };
    if (currentTeacherId) {
      if (record.teacherId.toString() !== String(currentTeacherId)) {
        return { success: false, statusCode: 403, message: "Bạn chỉ có thể xóa bản ghi của chính mình" };
      }
    }
    await TeachingRecords.findByIdAndDelete(recordId);
    return { success: true, data: { deletedId: recordId } };
  } catch (err) {
    console.error("teachingRecordsService.deleteTeachingRecord error:", err);
    return { success: false, statusCode: 500, message: "Có lỗi khi xóa bản ghi. Vui lòng thử lại." };
  }
};

module.exports = {
  getAllTeachingRecords,
  getTeachingRecordsByTeacher,
  createTeachingRecord,
  updateTeachingRecord,
  deleteTeachingRecord,
};