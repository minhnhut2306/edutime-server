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
} = require("../helper/createResponse.helper");

// ✅ FIX: src/controllers/teachingRecordsController.js

const getTeachingRecords = asyncHandler(async (req, res) => {
  const { teacherId: queryTeacherId, schoolYear: querySchoolYear } = req.query;
  const role = req.user?.role;
  const userId = req.user?.userId || req.user?._id || req.user?.id || req.user?.sub;

  // 🔍 DEBUG LOG
  console.log('📥 [Controller] getTeachingRecords:', {
    queryTeacherId,
    querySchoolYear,
    role,
    userId
  });

  // ✅ FIX: Convert schoolYear string sang ObjectId
  let schoolYearId = null;
  if (querySchoolYear) {
    const schoolYearDoc = await SchoolYear.findOne({ year: querySchoolYear });
    if (!schoolYearDoc) {
      console.log('❌ [Controller] School year not found:', querySchoolYear);
      return res
        .status(404)
        .json(notFoundResponse(`Không tìm thấy năm học ${querySchoolYear}`));
    }
    schoolYearId = schoolYearDoc._id;
    console.log('✅ [Controller] Found schoolYearId:', schoolYearId.toString());
  }

  if (role === "admin") {
    if (queryTeacherId) {
      const result = await teachingRecordsService.getTeachingRecordsByTeacher(
        queryTeacherId,
        schoolYearId
      );
      if (!result.success) {
        const statusCode = result.statusCode || 500;
        if (statusCode === 404) {
          return res.status(404).json(notFoundResponse(result.message));
        }
        return res.status(statusCode).json(serverErrorResponse(result.message));
      }
      
      console.log('✅ [Controller] Returning records for teacher:', {
        count: result.data.length,
        firstRecord: result.data[0] ? {
          teacherId: result.data[0].teacherId?.name,
          weekId: result.data[0].weekId?.weekNumber,
          classId: result.data[0].classId?.name
        } : null
      });
      
      return res.json(
        successResponse("Lấy danh sách bản ghi thành công", result.data)
      );
    }

    // ✅ FIX: Admin không chọn teacher → lấy TẤT CẢ records
    const resultAll = await teachingRecordsService.getAllTeachingRecords(
      schoolYearId
    );
    if (!resultAll.success) {
      const statusCode = resultAll.statusCode || 500;
      return res
        .status(statusCode)
        .json(serverErrorResponse(resultAll.message));
    }
    
    console.log('✅ [Controller] Returning ALL records:', {
      count: resultAll.data.length,
      firstRecord: resultAll.data[0] ? {
        teacherId: resultAll.data[0].teacherId?.name,
        weekId: resultAll.data[0].weekId?.weekNumber,
        classId: resultAll.data[0].classId?.name
      } : null
    });
    
    return res.json(
      successResponse("Lấy danh sách bản ghi thành công", resultAll.data)
    );
  }

  // User role logic...
  if (!userId) {
    return res.status(401).json(forbiddenResponse("Không xác định được user"));
  }

  const teacherDoc = await Teacher.findOne({ userId: userId });
  if (!teacherDoc) {
    return res
      .status(400)
      .json(
        badRequestResponse("Tài khoản của bạn chưa được liên kết với giáo viên")
      );
  }

  if (queryTeacherId && queryTeacherId !== teacherDoc._id.toString()) {
    return res
      .status(400)
      .json(badRequestResponse("Bạn chỉ được xem bản ghi của chính mình"));
  }

  const targetTeacherId = teacherDoc._id.toString();
  const result = await teachingRecordsService.getTeachingRecordsByTeacher(
    targetTeacherId,
    schoolYearId
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

  // ✅ FIX: Convert schoolYear string sang ObjectId
  let schoolYearId = null;
  if (schoolYear) {
    const schoolYearDoc = await SchoolYear.findOne({ year: schoolYear });
    if (!schoolYearDoc) {
      return res
        .status(404)
        .json(badRequestResponse(`Không tìm thấy năm học ${schoolYear}`));
    }
    schoolYearId = schoolYearDoc._id;
  }

  if (
    !teacherId ||
    !weekId ||
    !subjectId ||
    !classId ||
    !periods ||
    !schoolYearId
  ) {
    return res.status(400).json(badRequestResponse("Thiếu thông tin bắt buộc"));
  }

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
    schoolYearId, // ✅ Truyền ObjectId
    createdBy,
    recordType: recordType || "teaching",
    notes: notes || "",
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
  const role = req.user?.role;
  const userId = req.user?.userId || req.user?._id;

  if (!id) {
    return res.status(400).json(badRequestResponse("ID không hợp lệ"));
  }

  if (!userId && role !== "admin") {
    return res.status(401).json(forbiddenResponse("Không xác định được user"));
  }

  if (role === "admin") {
    const result = await teachingRecordsService.deleteTeachingRecord(id, null);
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

  const teacherDoc = await Teacher.findOne({ userId: userId });
  if (!teacherDoc) {
    return res
      .status(400)
      .json(
        badRequestResponse("Tài khoản của bạn chưa được liên kết với giáo viên")
      );
  }
  const currentTeacherId = teacherDoc._id.toString();

  const result = await teachingRecordsService.deleteTeachingRecord(
    id,
    currentTeacherId
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

  if (!id) {
    return res.status(400).json(badRequestResponse("ID không hợp lệ"));
  }

  // ✅ FIX: Convert schoolYear string sang ObjectId
  let schoolYearId = null;
  if (schoolYear) {
    const schoolYearDoc = await SchoolYear.findOne({ year: schoolYear });
    if (!schoolYearDoc) {
      return res
        .status(404)
        .json(badRequestResponse(`Không tìm thấy năm học ${schoolYear}`));
    }
    schoolYearId = schoolYearDoc._id;
  }

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
        schoolYearId, // ✅ Truyền ObjectId
        recordType,
        notes,
      },
      null
    );

    if (!result.success) {
      const statusCode = result.statusCode || 500;
      if (statusCode === 404)
        return res.status(404).json(notFoundResponse(result.message));
      if (statusCode === 403)
        return res.status(403).json(forbiddenResponse(result.message));
      if (statusCode === 409)
        return res.status(409).json(badRequestResponse(result.message));
      return res.status(statusCode).json(serverErrorResponse(result.message));
    }

    return res.json(
      successResponse("Cập nhật bản ghi thành công", result.data)
    );
  }

  if (!userId) {
    return res.status(401).json(forbiddenResponse("Không xác định được user"));
  }
  const teacherDoc = await Teacher.findOne({ userId: userId });
  if (!teacherDoc) {
    return res
      .status(400)
      .json(
        badRequestResponse("Tài khoản của bạn chưa được liên kết với giáo viên")
      );
  }

  if (teacherId && teacherId !== teacherDoc._id.toString()) {
    return res
      .status(403)
      .json(
        forbiddenResponse("Bạn không được chuyển bản ghi cho giáo viên khác")
      );
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
      schoolYearId, // ✅ Truyền ObjectId
      recordType,
      notes,
    },
    currentTeacherId
  );

  if (!result.success) {
    const statusCode = result.statusCode || 500;
    if (statusCode === 404)
      return res.status(404).json(notFoundResponse(result.message));
    if (statusCode === 403)
      return res.status(403).json(forbiddenResponse(result.message));
    if (statusCode === 409)
      return res.status(409).json(badRequestResponse(result.message));
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
