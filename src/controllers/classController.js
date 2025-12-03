const classService = require("../services/classService");
const asyncHandler = require("../middleware/asyncHandler");
const SchoolYear = require("../models/schoolYearModel");
const {
  successResponse,
  createdResponse,
  badRequestResponse
} = require("../helper/createResponse.helper");

const getSchoolYearId = async (schoolYearString) => {
  if (!schoolYearString) return null;
  
  const schoolYear = await SchoolYear.findOne({ year: schoolYearString });
  if (!schoolYear) {
    throw new Error(`Không tìm thấy năm học ${schoolYearString}`);
  }
  return schoolYear._id;
};

const getClasses = asyncHandler(async (req, res) => {
  const schoolYearId = await getSchoolYearId(req.query.schoolYear);
  
  const filters = {
    name: req.query.name,
    grade: req.query.grade,
    schoolYearId
  };

  const classes = await classService.getClasses(filters);
  
  res.json(
    successResponse("Lấy danh sách lớp học thành công", {
      classes,
      total: classes.length
    })
  );
});

const getClassById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id) {
    return res.status(400).json(
      badRequestResponse("Thiếu thông tin lớp học")
    );
  }

  const classInfo = await classService.getClassById(id);
  res.json(successResponse("Lấy thông tin lớp học thành công", classInfo));
});

const createClass = asyncHandler(async (req, res) => {
  const { name, studentCount } = req.body;

  if (!name?.trim()) {
    return res.status(400).json(
      badRequestResponse("Vui lòng nhập tên lớp học")
    );
  }

  const classInfo = await classService.createClass(req.body);
  res.status(201).json(createdResponse("Thêm lớp học thành công", classInfo));
});

const updateClass = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!id) {
    return res.status(400).json(
      badRequestResponse("Thiếu thông tin lớp học cần cập nhật")
    );
  }

  if (!name?.trim()) {
    return res.status(400).json(
      badRequestResponse("Vui lòng nhập tên lớp học")
    );
  }

  const classInfo = await classService.updateClass(id, req.body);
  res.json(successResponse("Cập nhật lớp học thành công", classInfo));
});

const deleteClass = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json(
      badRequestResponse("Thiếu thông tin lớp học cần xóa")
    );
  }

  const result = await classService.deleteClass(id);
  res.json(successResponse(result.message, result.deletedClass));
});

const importClasses = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json(
      badRequestResponse("Vui lòng chọn file Excel để tải lên")
    );
  }

  const result = await classService.importClasses(req.file);
  
  const message = result.failedCount > 0
    ? `Đã import ${result.successCount}/${result.total} lớp học. ${result.failedCount} lớp không thể thêm do lỗi`
    : `Import thành công ${result.successCount} lớp học`;

  res.json(
    successResponse(message, {
      total: result.total,
      successCount: result.successCount,
      failedCount: result.failedCount,
      success: result.success,
      failed: result.failed
    })
  );
});

module.exports = {
  getClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  importClasses
};