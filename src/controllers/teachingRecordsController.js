const teachingRecordsService = require("../services/teachingRecordsService");
const asyncHandler = require("../middleware/asyncHandler");
const {
  successResponse,
  createdResponse,
  notFoundResponse,
  forbiddenResponse,
  badRequestResponse,
  serverErrorResponse,
} = require("../helper/createResponse.helper");

const getTeachingRecords = asyncHandler(async (req, res) => {
  const { teacherId } = req.query;

  if (!teacherId) {
    return res
      .status(400)
      .json(badRequestResponse("teacherId là bắt buộc"));
  }

  const result = await teachingRecordsService.getTeachingRecordsByTeacher(
    teacherId
  );

  if (!result.success) {
    const statusCode = result.statusCode || 500;
    
    if (statusCode === 404) {
      return res.status(404).json(notFoundResponse(result.message));
    }
    
    return res.status(statusCode).json(serverErrorResponse(result.message));
  }

  return res.json(
    successResponse("Lấy danh sách bản ghi thành công", result.data)
  );
});

const createTeachingRecord = asyncHandler(async (req, res) => {
  const { teacherId, weekId, subjectId, classId, periods, schoolYear } =
    req.body;

  if (!teacherId || !weekId || !subjectId || !classId || !periods || !schoolYear) {
    return res
      .status(400)
      .json(badRequestResponse("Thiếu thông tin bắt buộc"));
  }

  if (periods < 1 || periods > 20) {
    return res
      .status(400)
      .json(badRequestResponse("Số tiết phải từ 1 đến 20"));
  }

  const schoolYearRegex = /^\d{4}-\d{4}$/;
  if (!schoolYearRegex.test(schoolYear)) {
    return res
      .status(400)
      .json(
        badRequestResponse("Năm học không đúng định dạng (VD: 2024-2025)")
      );
  }

  const createdBy = req.user?.email || req.user?.username || "system";

  const result = await teachingRecordsService.createTeachingRecord({
    teacherId,
    weekId,
    subjectId,
    classId,
    periods,
    schoolYear,
    createdBy,
  });

  if (!result.success) {
    const statusCode = result.statusCode || 500;
    
    if (statusCode === 404) {
      return res.status(404).json(notFoundResponse(result.message));
    }
    
    if (statusCode === 403) {
      return res.status(403).json(forbiddenResponse(result.message));
    }
    
    if (statusCode === 409) {
      return res.status(409).json(badRequestResponse(result.message));
    }
    
    return res.status(statusCode).json(badRequestResponse(result.message));
  }

  return res
    .status(201)
    .json(createdResponse("Thêm bản ghi thành công", result.data));
});

const deleteTeachingRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user?.userId || req.user?._id;

  if (!id) {
    return res.status(400).json(badRequestResponse("ID không hợp lệ"));
  }

  if (!currentUserId) {
    return res
      .status(401)
      .json(forbiddenResponse("Không xác định được user"));
  }

  const result = await teachingRecordsService.deleteTeachingRecord(
    id,
    currentUserId
  );

  if (!result.success) {
    const statusCode = result.statusCode || 500;
    
    if (statusCode === 404) {
      return res.status(404).json(notFoundResponse(result.message));
    }
    
    if (statusCode === 403) {
      return res.status(403).json(forbiddenResponse(result.message));
    }
    
    return res.status(statusCode).json(serverErrorResponse(result.message));
  }

  return res.json(
    successResponse("Xóa bản ghi thành công", result.data)
  );
});

module.exports = {
  getTeachingRecords,
  createTeachingRecord,
  deleteTeachingRecord,
};