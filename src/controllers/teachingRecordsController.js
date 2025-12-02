const mongoose = require("mongoose");
const teachingRecordsService = require("../services/teachingRecordsService");
const asyncHandler = require("../middleware/asyncHandler");
const Teacher = require("../models/teacherModel");
const SchoolYear = require("../models/schoolYearModel");
const {
  successResponse,
  createdResponse,
  notFoundResponse,
  forbiddenResponse,
  badRequestResponse,
  serverErrorResponse,
  STATUS_CODES,
} = require("../helper/createResponse.helper");

const resolveSchoolYearId = async (schoolYear) => {
  if (!schoolYear) return null;
  const sy = await SchoolYear.findOne({ $or: [{ year: schoolYear }, { _id: schoolYear }] });
  return sy ? sy._id : null;
};

const getTeachingRecords = asyncHandler(async (req, res) => {
  const { teacherId: queryTeacherId, schoolYear: querySchoolYear } = req.query;
  const role = req.user?.role;
  const userId = req.user?.userId || req.user?._id || req.user?.id || req.user?.sub;

  let schoolYearId = null;
  if (querySchoolYear) {
    const resolved = await resolveSchoolYearId(querySchoolYear);
    if (!resolved) return res.status(404).json(notFoundResponse("Không tìm thấy năm học. Vui lòng chọn lại."));
    schoolYearId = resolved;
  }

  if (role === "admin") {
    if (queryTeacherId) {
      const result = await teachingRecordsService.getTeachingRecordsByTeacher(queryTeacherId, schoolYearId);
      if (!result.success) {
        const statusCode = result.statusCode || 500;
        if (statusCode === 404) return res.status(404).json(notFoundResponse(result.message));
        return res.status(statusCode).json(serverErrorResponse(result.message));
      }
      return res.json(successResponse("Lấy danh sách bản ghi thành công", result.data));
    }

    const resultAll = await teachingRecordsService.getAllTeachingRecords(schoolYearId);
    if (!resultAll.success) {
      const statusCode = resultAll.statusCode || 500;
      return res.status(statusCode).json(serverErrorResponse(resultAll.message));
    }
    return res.json(successResponse("Lấy danh sách bản ghi thành công", resultAll.data));
  }

  if (!userId) {
    return res.status(401).json(forbiddenResponse("Không xác định được người dùng"));
  }

  const teacherDoc = await Teacher.findOne({ userId: userId });
  if (!teacherDoc) {
    return res.status(400).json(badRequestResponse("Tài khoản của bạn chưa được liên kết với giáo viên"));
  }

  if (queryTeacherId && queryTeacherId !== teacherDoc._id.toString()) {
    return res.status(403).json(forbiddenResponse("Bạn chỉ được xem bản ghi của chính mình"));
  }

  const targetTeacherId = teacherDoc._id.toString();
  const result = await teachingRecordsService.getTeachingRecordsByTeacher(targetTeacherId, schoolYearId);
  if (!result.success) {
    const statusCode = result.statusCode || 500;
    if (statusCode === 404) return res.status(404).json(notFoundResponse(result.message));
    return res.status(statusCode).json(serverErrorResponse(result.message));
  }

  return res.json(successResponse("Lấy danh sách bản ghi thành công", result.data));
});

const createTeachingRecord = asyncHandler(async (req, res) => {
  const {
    teacherId,
    weekId,
    subjectId,
    classId,
    periods,
    schoolYear,
    recordType,
    notes,
  } = req.body;

  const schoolYearId = await resolveSchoolYearId(schoolYear);
  if (schoolYear && !schoolYearId) return res.status(404).json(badRequestResponse("Không tìm thấy năm học. Vui lòng kiểm tra lại."));

  if (!teacherId || !weekId || !subjectId || !classId || periods === undefined || !schoolYearId) {
    return res.status(400).json(badRequestResponse("Thiếu thông tin bắt buộc. Vui lòng kiểm tra lại."));
  }

  if (!mongoose.Types.ObjectId.isValid(String(teacherId))) return res.status(400).json(badRequestResponse("Thông tin giáo viên không hợp lệ"));
  if (!mongoose.Types.ObjectId.isValid(String(weekId))) return res.status(400).json(badRequestResponse("Thông tin tuần học không hợp lệ"));
  if (!mongoose.Types.ObjectId.isValid(String(subjectId))) return res.status(400).json(badRequestResponse("Thông tin môn học không hợp lệ"));
  if (!mongoose.Types.ObjectId.isValid(String(classId))) return res.status(400).json(badRequestResponse("Thông tin lớp học không hợp lệ"));

  if (periods < 1 || periods > 20) {
    return res.status(400).json(badRequestResponse("Số tiết phải từ 1 đến 20"));
  }

  const createdBy = req.user?.email || req.user?.username || "system";

  const result = await teachingRecordsService.createTeachingRecord({
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

  if (!result.success) {
    const statusCode = result.statusCode || 500;
    if (statusCode === 404) return res.status(404).json(notFoundResponse(result.message));
    if (statusCode === 403) return res.status(403).json(forbiddenResponse(result.message));
    if (statusCode === 409) return res.status(409).json(badRequestResponse(result.message));
    return res.status(statusCode).json(serverErrorResponse(result.message));
  }

  return res.status(201).json(createdResponse("Thêm bản ghi thành công", result.data));
});

const deleteTeachingRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const role = req.user?.role;
  const userId = req.user?.userId || req.user?._id;

  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json(badRequestResponse("Thông tin bản ghi không hợp lệ"));
  }

  if (!userId && role !== "admin") {
    return res.status(401).json(forbiddenResponse("Không xác định được người dùng"));
  }

  if (role === "admin") {
    const result = await teachingRecordsService.deleteTeachingRecord(id, null);
    if (!result.success) {
      const statusCode = result.statusCode || 500;
      if (statusCode === 404) return res.status(404).json(notFoundResponse(result.message));
      if (statusCode === 403) return res.status(403).json(forbiddenResponse(result.message));
      return res.status(statusCode).json(serverErrorResponse(result.message));
    }
    return res.json(successResponse("Xóa bản ghi thành công", result.data));
  }

  const teacherDoc = await Teacher.findOne({ userId: userId });
  if (!teacherDoc) {
    return res.status(400).json(badRequestResponse("Tài khoản của bạn chưa được liên kết với giáo viên"));
  }
  const currentTeacherId = teacherDoc._id.toString();

  const result = await teachingRecordsService.deleteTeachingRecord(id, currentTeacherId);
  if (!result.success) {
    const statusCode = result.statusCode || 500;
    if (statusCode === 404) return res.status(404).json(notFoundResponse(result.message));
    if (statusCode === 403) return res.status(403).json(forbiddenResponse(result.message));
    return res.status(statusCode).json(serverErrorResponse(result.message));
  }

  return res.json(successResponse("Xóa bản ghi thành công", result.data));
});

const updateTeachingRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    teacherId,
    weekId,
    subjectId,
    classId,
    periods,
    schoolYear,
    recordType,
    notes,
  } = req.body;

  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json(badRequestResponse("Thông tin bản ghi không hợp lệ"));
  }

  const schoolYearId = await resolveSchoolYearId(schoolYear);
  if (schoolYear && !schoolYearId) return res.status(404).json(badRequestResponse("Không tìm thấy năm học. Vui lòng kiểm tra lại."));

  const role = req.user?.role;
  const userId = req.userId || req.user?.userId || req.user?._id;

  if (role === "admin") {
    const result = await teachingRecordsService.updateTeachingRecord(
      id,
      {
        teacherId,
        weekId,
        subjectId,
        classId,
        periods,
        schoolYearId,
        recordType,
        notes,
      },
      null
    );
    if (!result.success) {
      const statusCode = result.statusCode || 500;
      if (statusCode === 404) return res.status(404).json(notFoundResponse(result.message));
      if (statusCode === 403) return res.status(403).json(forbiddenResponse(result.message));
      if (statusCode === 409) return res.status(409).json(badRequestResponse(result.message));
      return res.status(statusCode).json(serverErrorResponse(result.message));
    }
    return res.json(successResponse("Cập nhật bản ghi thành công", result.data));
  }

  if (!userId) {
    return res.status(401).json(forbiddenResponse("Không xác định được người dùng"));
  }

  const teacherDoc = await Teacher.findOne({ userId: userId });
  if (!teacherDoc) {
    return res.status(400).json(badRequestResponse("Tài khoản của bạn chưa được liên kết với giáo viên"));
  }

  if (teacherId && teacherId !== teacherDoc._id.toString()) {
    return res.status(403).json(forbiddenResponse("Bạn không được chuyển bản ghi cho giáo viên khác"));
  }

  const currentTeacherId = teacherDoc._id.toString();

  const result = await teachingRecordsService.updateTeachingRecord(
    id,
    {
      teacherId: teacherId || currentTeacherId,
      weekId,
      subjectId,
      classId,
      periods,
      schoolYearId,
      recordType,
      notes,
    },
    currentTeacherId
  );

  if (!result.success) {
    const statusCode = result.statusCode || 500;
    if (statusCode === 404) return res.status(404).json(notFoundResponse(result.message));
    if (statusCode === 403) return res.status(403).json(forbiddenResponse(result.message));
    if (statusCode === 409) return res.status(409).json(badRequestResponse(result.message));
    return res.status(statusCode).json(serverErrorResponse(result.message));
  }

  return res.json(successResponse("Cập nhật bản ghi thành công", result.data));
});

module.exports = {
  getTeachingRecords,
  createTeachingRecord,
  updateTeachingRecord,
  deleteTeachingRecord,
};