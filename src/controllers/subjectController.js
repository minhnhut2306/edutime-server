const subjectService = require("../services/subjectService");
const asyncHandler = require("../middleware/asyncHandler");
const SchoolYear = require("../models/schoolYearModel");
const {
  successResponse,
  createdResponse,
  badRequestResponse
} = require("../helper/createResponse.helper");

const MONGODB_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

const getSchoolYearId = async (schoolYearString) => {
  if (!schoolYearString) return null;
  
  const schoolYear = await SchoolYear.findOne({ year: schoolYearString });
  if (!schoolYear) {
    throw new Error(`Không tìm thấy năm học ${schoolYearString}`);
  }
  return schoolYear._id;
};

const getSubjects = asyncHandler(async (req, res) => {
  const schoolYearId = await getSchoolYearId(req.query.schoolYear);

  const filters = {
    name: req.query.name,
    schoolYearId
  };

  const subjects = await subjectService.getSubjects(filters);
  
  return res.json(
    successResponse("Lấy danh sách môn học thành công", { subjects })
  );
});

const createSubject = asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (!name?.trim()) {
    return res.status(400).json(
      badRequestResponse("Tên môn học không được để trống")
    );
  }

  const subject = await subjectService.createSubject({ name: name.trim() });
  
  return res.status(201).json(
    createdResponse("Tạo môn học thành công", { subject })
  );
});

const updateSubject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!MONGODB_ID_PATTERN.test(id)) {
    return res.status(400).json(
      badRequestResponse("Thông tin môn học không hợp lệ")
    );
  }

  if (!name?.trim()) {
    return res.status(400).json(
      badRequestResponse("Tên môn học không được để trống")
    );
  }

  const subject = await subjectService.updateSubject(id, { name: name.trim() });
  
  return res.json(
    successResponse("Cập nhật môn học thành công", { subject })
  );
});

const deleteSubject = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!MONGODB_ID_PATTERN.test(id)) {
    return res.status(400).json(
      badRequestResponse("Thông tin môn học không hợp lệ")
    );
  }

  const result = await subjectService.deleteSubject(id);
  
  return res.json(
    successResponse(result.message, { subject: result.deletedSubject })
  );
});

module.exports = {
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject
};