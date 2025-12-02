const classService = require("../services/classService");
const asyncHandler = require("../middleware/asyncHandler");
const SchoolYear = require("../models/schoolYearModel");
const {
  successResponse,
  createdResponse,
  badRequestResponse,
  notFoundResponse
} = require("../helper/createResponse.helper");

const getClasses = asyncHandler(async (req, res) => {
  let schoolYearId = null;
  if (req.query.schoolYear) {
    const schoolYear = await SchoolYear.findOne({ year: req.query.schoolYear });
    if (!schoolYear) {
      return res.status(404).json(notFoundResponse(`Không tìm thấy năm học ${req.query.schoolYear}`));
    }
    schoolYearId = schoolYear._id;
  }

  const filters = {
    name: req.query.name,
    grade: req.query.grade,
    schoolYearId
  };

  const classes = await classService.getClasses(filters);

  res.json(successResponse("Lấy danh sách lớp học thành công", {
    classes,
    total: classes.length
  }));
});

const getClassById = asyncHandler(async (req, res) => {
  const classInfo = await classService.getClassById(req.params.id);
  res.json(successResponse("Lấy thông tin lớp học thành công", classInfo));
});

const createClass = asyncHandler(async (req, res) => {
  const classInfo = await classService.createClass(req.body);
  res.status(201).json(createdResponse("Tạo lớp học thành công", classInfo));
});

const updateClass = asyncHandler(async (req, res) => {
  const classInfo = await classService.updateClass(req.params.id, req.body);
  res.json(successResponse("Cập nhật lớp học thành công", classInfo));
});

const deleteClass = asyncHandler(async (req, res) => {
  const result = await classService.deleteClass(req.params.id);
  res.json(successResponse(result.message, result.deletedClass));
});

const importClasses = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json(badRequestResponse("Vui lòng tải lên file Excel"));
  }
  const result = await classService.importClasses(req.file);
  res.json(successResponse("Import danh sách lớp học hoàn tất", {
    total: result.total,
    successCount: result.successCount,
    failedCount: result.failedCount,
    success: result.success,
    failed: result.failed
  }));
});

module.exports = {
  getClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  importClasses
};