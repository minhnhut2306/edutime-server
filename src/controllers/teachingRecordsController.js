/**
 * Controller: teachingRecords.controller.js
 * Contains getTeachingRecords, createTeachingRecord, deleteTeachingRecord
 */

const teachingRecordsService = require("../services/teachingRecordsService");
const asyncHandler = require("../middleware/asyncHandler");
const Teacher = require("../models/teacherModel");
const {
  successResponse,
  createdResponse,
  notFoundResponse,
  forbiddenResponse,
  badRequestResponse,
  serverErrorResponse,
} = require("../helper/createResponse.helper");

// Lấy danh sách bản ghi:
// - Admin: nếu có teacherId query -> trả bản ghi của teacher đó, nếu không -> trả tất cả
// - Giáo viên: lấy teacher bằng userId trong token, trả bản ghi của chính họ
const getTeachingRecords = asyncHandler(async (req, res) => {
  const { teacherId: queryTeacherId } = req.query;
  const role = req.user?.role;

  // Thử nhiều cách lấy userId từ req.user payload
  const userId = req.user?.userId || req.user?._id || req.user?.id || req.user?.sub;

  console.log("🔍 Debug req.user:", req.user);
  console.log("🔍 Extracted userId:", userId);
  console.log("🔍 Role:", role);

  // Admin: nếu có queryTeacherId -> trả bản ghi của teacher đó, không có -> trả tất cả
  if (role === "admin") {
    if (queryTeacherId) {
      const result = await teachingRecordsService.getTeachingRecordsByTeacher(queryTeacherId);
      if (!result.success) {
        const statusCode = result.statusCode || 500;
        if (statusCode === 404) {
          return res.status(404).json(notFoundResponse(result.message));
        }
        return res.status(statusCode).json(serverErrorResponse(result.message));
      }
      return res.json(successResponse("Lấy danh sách bản ghi thành công", result.data));
    }

    const resultAll = await teachingRecordsService.getAllTeachingRecords();
    if (!resultAll.success) {
      const statusCode = resultAll.statusCode || 500;
      return res.status(statusCode).json(serverErrorResponse(resultAll.message));
    }
    return res.json(successResponse("Lấy danh sách bản ghi thành công", resultAll.data));
  }

  // Non-admin (giáo viên): tự động tìm teacher document theo userId
  // NOTE: nếu không có userId -> mặc định hiện tại trả lỗi 401/403
  if (!userId) {
    console.error("❌ Không tìm thấy userId trong req.user:", req.user);
    return res.status(401).json(forbiddenResponse("Không xác định được user"));
  }

  const teacherDoc = await Teacher.findOne({ userId: userId });
  if (!teacherDoc) {
    console.error("❌ Không tìm thấy teacher với userId:", userId);
    return res.status(400).json(badRequestResponse("Tài khoản của bạn chưa được liên kết với giáo viên"));
  }

  // Nếu frontend gửi queryTeacherId, đảm bảo nó trùng với teacherDoc._id
  if (queryTeacherId && queryTeacherId !== teacherDoc._id.toString()) {
    return res.status(400).json(badRequestResponse("Bạn chỉ được xem bản ghi của chính mình"));
  }

  const targetTeacherId = teacherDoc._id.toString();
  const result = await teachingRecordsService.getTeachingRecordsByTeacher(targetTeacherId);

  if (!result.success) {
    const statusCode = result.statusCode || 500;
    if (statusCode === 404) {
      return res.status(404).json(notFoundResponse(result.message));
    }
    return res.status(statusCode).json(serverErrorResponse(result.message));
  }

  return res.json(successResponse("Lấy danh sách bản ghi thành công", result.data));
});

// Thêm bản ghi
const createTeachingRecord = asyncHandler(async (req, res) => {
  const { teacherId, weekId, subjectId, classId, periods, schoolYear } = req.body;

  if (!teacherId || !weekId || !subjectId || !classId || !periods || !schoolYear) {
    return res.status(400).json(badRequestResponse("Thiếu thông tin bắt buộc"));
  }

  if (periods < 1 || periods > 20) {
    return res.status(400).json(badRequestResponse("Số tiết phải từ 1 đến 20"));
  }

  const schoolYearRegex = /^\d{4}-\d{4}$/;
  if (!schoolYearRegex.test(schoolYear)) {
    return res
      .status(400)
      .json(badRequestResponse("Năm học không đúng định dạng (VD: 2024-2025)"));
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

  return res.status(201).json(createdResponse("Thêm bản ghi thành công", result.data));
});



// Xóa bản ghi:
// - Admin có thể xóa bất kỳ bản ghi nào
// - Giáo viên chỉ được xóa bản ghi của chính họ
const deleteTeachingRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const role = req.user?.role;
  const userId = req.user?.userId || req.user?._id;

  if (!id) {
    return res.status(400).json(badRequestResponse("ID không hợp lệ"));
  }

  if (!userId && role !== "admin") {
    return res.status(401).json(forbiddenResponse("Không xác định được user"));
  }

  // Nếu admin => cho phép xóa (service sẽ xử lý admin case)
  if (role === "admin") {
    const result = await teachingRecordsService.deleteTeachingRecord(id, null /* admin */);
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
    return res.json(successResponse("Xóa bản ghi thành công", result.data));
  }

  // Non-admin: tìm teacher document liên kết với user và truyền teacher._id cho service
  const teacherDoc = await Teacher.findOne({ userId: userId });
  if (!teacherDoc) {
    return res.status(400).json(badRequestResponse("Tài khoản của bạn chưa được liên kết với giáo viên"));
  }
  const currentTeacherId = teacherDoc._id.toString();

  const result = await teachingRecordsService.deleteTeachingRecord(id, currentTeacherId);

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

  return res.json(successResponse("Xóa bản ghi thành công", result.data));
});

const updateTeachingRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { teacherId, weekId, subjectId, classId, periods, schoolYear } = req.body;

  if (!id) {
    return res.status(400).json(badRequestResponse("ID không hợp lệ"));
  }

  const role = req.user?.role;
  const userId = req.userId || req.user?.userId || req.user?._id;

  // Admin: can update any; non-admin: must belong to the teacher linked to user
  if (role === "admin") {
    const result = await teachingRecordsService.updateTeachingRecord(id, {
      teacherId,
      weekId,
      subjectId,
      classId,
      periods,
      schoolYear,
    }, null); // null => admin
    if (!result.success) {
      const statusCode = result.statusCode || 500;
      if (statusCode === 404) return res.status(404).json(notFoundResponse(result.message));
      if (statusCode === 403) return res.status(403).json(forbiddenResponse(result.message));
      if (statusCode === 409) return res.status(409).json(badRequestResponse(result.message));
      return res.status(statusCode).json(serverErrorResponse(result.message));
    }
    return res.json(successResponse("Cập nhật bản ghi thành công", result.data));
  }

  // Non-admin
  if (!userId) {
    return res.status(401).json(forbiddenResponse("Không xác định được user"));
  }
  const teacherDoc = await Teacher.findOne({ userId: userId });
  if (!teacherDoc) {
    return res.status(400).json(badRequestResponse("Tài khoản của bạn chưa được liên kết với giáo viên"));
  }

  // If req.body.teacherId exists and is different from teacherDoc._id, forbid
  if (teacherId && teacherId !== teacherDoc._id.toString()) {
    return res.status(403).json(forbiddenResponse("Bạn không được chuyển bản ghi cho giáo viên khác"));
  }

  const currentTeacherId = teacherDoc._id.toString();

  const result = await teachingRecordsService.updateTeachingRecord(id, {
    teacherId: teacherId || currentTeacherId,
    weekId,
    subjectId,
    classId,
    periods,
    schoolYear,
  }, currentTeacherId);

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