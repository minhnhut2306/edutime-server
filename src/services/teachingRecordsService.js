const TeachingRecords = require("../models/teachingRecordsModel");
const Teacher = require("../models/teacherModel");
const Week = require("../models/weekModel");
const Subject = require("../models/subjectModel");
const Class = require("../models/classesModel");

const getTeachingRecordsByTeacher = async (teacherId) => {
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) {
    throw new Error("Không tìm thấy giáo viên");
  }

  const records = await TeachingRecords.find({ teacherId })
    .populate("weekId", "weekNumber startDate endDate schoolYear")
    .populate("subjectId", "name code")
    .populate("classId", "name grade")
    .sort({ createdAt: -1 });

  return {
    records,
    total: records.length,
  };
};

const createTeachingRecord = async (data) => {
  const { teacherId, weekId, subjectId, classId, periods, schoolYear, createdBy } = data;

  const [teacher, week, subject, classData, existingRecord] = await Promise.all([
    Teacher.findById(teacherId),
    Week.findById(weekId),
    Subject.findById(subjectId),
    Class.findById(classId),
    TeachingRecords.findOne({ teacherId, weekId, subjectId, classId })
  ]);

  if (!teacher) {
    throw new Error("Không tìm thấy giáo viên");
  }

  if (!week) {
    throw new Error("Không tìm thấy tuần học");
  }

  if (!subject) {
    throw new Error("Không tìm thấy môn học");
  }

  if (!classData) {
    throw new Error("Không tìm thấy lớp học");
  }

  if (
    teacher.allowedGrades &&
    teacher.allowedGrades.length > 0 &&
    !teacher.allowedGrades.includes(classData.grade)
  ) {
    throw new Error(
      `Bạn không có quyền dạy khối ${classData.grade}. Chỉ được dạy khối: ${teacher.allowedGrades.join(", ")}`
    );
  }

  if (existingRecord) {
    throw new Error("Bản ghi này đã tồn tại (cùng tuần, môn học và lớp)");
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

  return populatedRecord;
};

const deleteTeachingRecord = async (recordId, currentUserId) => {
  const record = await TeachingRecords.findById(recordId);

  if (!record) {
    throw new Error("Không tìm thấy bản ghi");
  }

  if (record.teacherId.toString() !== currentUserId.toString()) {
    throw new Error("Bạn chỉ có thể xóa bản ghi của chính mình");
  }

  await TeachingRecords.findByIdAndDelete(recordId);

  return { deletedId: recordId };
};

module.exports = {
  getTeachingRecordsByTeacher,
  createTeachingRecord,
  deleteTeachingRecord,
};