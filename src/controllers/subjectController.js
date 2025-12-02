const subjectService = require("../services/subjectService");
const asyncHandler = require("../middleware/asyncHandler");
const SchoolYear = require("../models/schoolYearModel");
const mongoose = require("mongoose");
const {
  successResponse,
  createdResponse,
  notFoundResponse,
  badRequestResponse,
  conflictResponse
} = require("../helper/createResponse.helper");

const getSubjects = asyncHandler(async (req, res) => {
  let schoolYearId = null;
  if (req.query.schoolYear) {
    const sy = await SchoolYear.findOne({ $or: [{ year: req.query.schoolYear }, { _id: req.query.schoolYear }] });
    if (!sy) {
      return res.status(404).json(notFoundResponse(`Không tìm thấy năm học "${req.query.schoolYear}". Vui lòng chọn lại.`));
    }
    schoolYearId = sy._id;
  }
  const filters = {
    name: req.query.name,
    schoolYearId
  };
  const subjects = await subjectService.getSubjects(filters);
  return res.json(successResponse("Lấy danh sách môn học thành công", { subjects }));
});

const createSubject = asyncHandler(async (req, res) => {
  const { name, schoolYearId } = req.body;
  if (!name || name.trim() === "") {
    return res.status(400).json(badRequestResponse("Vui lòng nhập tên môn học"));
  }
  if (schoolYearId && !mongoose.Types.ObjectId.isValid(String(schoolYearId))) {
    return res.status(400).json(badRequestResponse("Năm học không hợp lệ. Vui lòng chọn năm học"));
  }
  try {
    const subject = await subjectService.createSubject({ name: name.trim(), schoolYearId });
    return res.status(201).json(createdResponse("Tạo môn học thành công", { subject }));
  } catch (err) {
    if (err.message && err.message.includes("đã tồn tại")) {
      return res.status(409).json(conflictResponse(err.message));
    }
    throw err;
  }
});

const deleteSubject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json(badRequestResponse("Vui lòng chọn môn học hợp lệ"));
  }
  const result = await subjectService.deleteSubject(id);
  return res.json(successResponse(result.message, { subject: result.deletedSubject }));
});

module.exports = {
  getSubjects,
  createSubject,
  deleteSubject
};