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
  serverErrorResponse
} = require("../helper/createResponse.helper");

const getSchoolYearId = async (schoolYearString) => {
  if (!schoolYearString) return null;
  
  const schoolYear = await SchoolYear.findOne({ year: schoolYearString });
  if (!schoolYear) {
    throw new Error(`Không tìm thấy năm học ${schoolYearString}`);
  }
  return schoolYear._id;
};

const getUserId = (user) => {
  return user?.userId || user?._id || user?.id || user?.sub;
};

const handleServiceResult = (result, res, successMessage) => {
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
    return res.status(statusCode).json(serverErrorResponse(result.message));
  }
  
  return res.json(successResponse(successMessage, result.data));
};

const getTeachers = async (userId) => {
  if (!userId) {
    throw new Error("Không xác định được user");
  }

  const teacher = await Teacher.findOne({ userId });
  if (!teacher) {
    throw new Error("Tài khoản của bạn chưa được liên kết với giáo viên");
  }

  return teacher;
};

const getTeachingRecords = asyncHandler(async (req, res) => {
  const { 
    teacherId: queryTeacherId, 
    schoolYear: querySchoolYear,
    weekId,
    classId,
    subjectId,
    recordType,
    semester,
    page = 1,
    limit = 10
  } = req.query;

  const role = req.user?.role;
  const userId = getUserId(req.user);

  const schoolYearId = await getSchoolYearId(querySchoolYear);

  const filters = {
    schoolYearId,
    weekId,
    classId,
    subjectId,
    recordType,
    semester
  };

  const pagination = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10)
  };

  if (role === "admin") {
    if (queryTeacherId) {
      const result = await teachingRecordsService.getTeachingRecordsByTeacher(
        queryTeacherId,
        filters,
        pagination
      );
      return handleServiceResult(result, res, "Lấy danh sách bản ghi thành công");
    }   

    const resultAll = await teachingRecordsService.getAllTeachingRecords(
      filters,
      pagination
    );
    return handleServiceResult(resultAll, res, "Lấy danh sách bản ghi thành công");
  }

  const teacher = await getTeachers(userId);

  if (queryTeacherId && queryTeacherId !== teacher._id.toString()) {
    return res.status(400).json(
      badRequestResponse("Bạn chỉ được xem bản ghi của chính mình")
    );
  }

  const result = await teachingRecordsService.getTeachingRecordsByTeacher(
    teacher._id.toString(),
    filters,
    pagination
  );

  return handleServiceResult(result, res, "Lấy danh sách bản ghi thành công");
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
    notes
  } = req.body;

  const schoolYearId = await getSchoolYearId(schoolYear);

  if (!teacherId || !weekId || !subjectId || !classId || !periods || !schoolYearId) {
    return res.status(400).json(
      badRequestResponse("Thiếu thông tin bắt buộc")
    );
  }

  if (periods < 1 || periods > 20) {
    return res.status(400).json(
      badRequestResponse("Mỗi bản ghi số tiết phải từ 1 đến 20")
    );
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
    notes: notes || ""
  });

  if (!result.success) {
    return handleServiceResult(result, res, "");
  }

  return res.status(201).json(
    createdResponse("Thêm bản ghi thành công", result.data)
  );
});

const deleteTeachingRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const role = req.user?.role;
  const userId = getUserId(req.user);

  if (!id) {
    return res.status(400).json(
      badRequestResponse("Không tìm thấy bản ghi cần xóa")
    );
  }

  if (role === "admin") {
    const result = await teachingRecordsService.deleteTeachingRecord(id, null);
    return handleServiceResult(result, res, "Xóa bản ghi thành công");
  }

  const teacher = await getTeachers(userId);
  const result = await teachingRecordsService.deleteTeachingRecord(
    id,
    teacher._id.toString()
  );

  return handleServiceResult(result, res, "Xóa bản ghi thành công");
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
    notes
  } = req.body;

  if (!id) {
    return res.status(400).json(
      badRequestResponse("Không tìm thấy bản ghi cần cập nhật")
    );
  }

  const schoolYearId = await getSchoolYearId(schoolYear);
  const role = req.user?.role;
  const userId = getUserId(req.user);

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
        notes
      },
      null
    );

    return handleServiceResult(result, res, "Cập nhật bản ghi thành công");
  }

  const teacher = await getTeachers(userId);

  if (teacherId && teacherId !== teacher._id.toString()) {
    return res.status(403).json(
      forbiddenResponse("Bạn không được chuyển bản ghi cho giáo viên khác")
    );
  }

  const result = await teachingRecordsService.updateTeachingRecord(
    id,
    {
      teacherId: teacherId || teacher._id.toString(),
      weekId,
      subjectId,
      classId,
      periods,
      schoolYearId,
      recordType,
      notes
    },
    teacher._id.toString()
  );

  return handleServiceResult(result, res, "Cập nhật bản ghi thành công");
});

module.exports = {
  getTeachingRecords,
  createTeachingRecord,
  updateTeachingRecord,
  deleteTeachingRecord
};