// controllers/teachingRecordsController.js

const teachingRecordsService = require("../services/teachingRecordsService");
const {
  successResponse,
  createdResponse,
  notFoundResponse,
  forbiddenResponse,
  badRequestResponse,
  serverErrorResponse,
} = require("../helper/createResponse.helper");

/**
 * GET /api/teaching-records
 * Lấy danh sách bản ghi giảng dạy theo teacherId
 */
const getTeachingRecords = async (req, res) => {
  try {
    const { teacherId } = req.query;

    // Validation
    if (!teacherId) {
      return res
        .status(400)
        .json(badRequestResponse("teacherId là bắt buộc"));
    }

    // Gọi service
    const result = await teachingRecordsService.getTeachingRecordsByTeacher(
      teacherId
    );

    // Xử lý kết quả
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
  } catch (error) {
    console.error("Error in getTeachingRecords controller:", error);
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi khi lấy danh sách bản ghi"));
  }
};

/**
 * POST /api/teaching-records
 * Thêm bản ghi giảng dạy mới
 */
const createTeachingRecord = async (req, res) => {
  try {
    const { teacherId, weekId, subjectId, classId, periods, schoolYear } =
      req.body;

    // Validation cơ bản
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

    // Lấy thông tin user từ middleware
    const createdBy = req.user?.email || req.user?.username || "system";

    // Gọi service
    const result = await teachingRecordsService.createTeachingRecord({
      teacherId,
      weekId,
      subjectId,
      classId,
      periods,
      schoolYear,
      createdBy,
    });

    // Xử lý kết quả
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
  } catch (error) {
    console.error("Error in createTeachingRecord controller:", error);
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi khi tạo bản ghi"));
  }
};

/**
 * DELETE /api/teaching-records/:id
 * Xóa bản ghi giảng dạy (chỉ xóa của mình)
 */
const deleteTeachingRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.userId || req.user?._id;

    // Validation
    if (!id) {
      return res.status(400).json(badRequestResponse("ID không hợp lệ"));
    }

    if (!currentUserId) {
      return res
        .status(401)
        .json(forbiddenResponse("Không xác định được user"));
    }

    // Gọi service
    const result = await teachingRecordsService.deleteTeachingRecord(
      id,
      currentUserId
    );

    // Xử lý kết quả
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
  } catch (error) {
    console.error("Error in deleteTeachingRecord controller:", error);
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi khi xóa bản ghi"));
  }
};

module.exports = {
  getTeachingRecords,
  createTeachingRecord,
  deleteTeachingRecord,
};