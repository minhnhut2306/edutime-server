const mongoose = require("mongoose");
const weekService = require("../services/weekService");
const asyncHandler = require("../middleware/asyncHandler");
const SchoolYear = require("../models/schoolYearModel");
const {
  successResponse,
  createdResponse,
  notFoundResponse,
  badRequestResponse,
} = require("../helper/createResponse.helper");

const resolveSchoolYearId = async (schoolYear) => {
  if (!schoolYear) return null;
  const sy = await SchoolYear.findOne({ $or: [{ year: schoolYear }, { _id: schoolYear }] });
  return sy ? sy._id : null;
};

const getWeeks = asyncHandler(async (req, res) => {
  const { schoolYear, weekNumber } = req.query;
  let schoolYearId = null;

  if (schoolYear) {
    const resolved = await resolveSchoolYearId(schoolYear);
    if (!resolved) {
      return res.status(404).json(notFoundResponse("Không tìm thấy năm học. Vui lòng chọn lại."));
    }
    schoolYearId = resolved;
  }

  const filters = {
    schoolYearId,
    weekNumber: weekNumber ? Number(weekNumber) : undefined,
  };

  const weeks = await weekService.getWeeks(filters);
  return res.json(successResponse("Lấy danh sách tuần học thành công", { weeks }));
});

const createWeek = asyncHandler(async (req, res) => {
  const { startDate, endDate, schoolYear } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json(badRequestResponse("Vui lòng cung cấp cả ngày bắt đầu và ngày kết thúc"));
  }

  let schoolYearId = null;
  if (schoolYear) {
    const resolved = await resolveSchoolYearId(schoolYear);
    if (!resolved) {
      return res.status(404).json(notFoundResponse("Không tìm thấy năm học. Vui lòng chọn lại."));
    }
    schoolYearId = resolved;
  }

  try {
    const week = await weekService.createWeek({ startDate, endDate, schoolYearId });
    return res.status(201).json(createdResponse("Tạo tuần học thành công", { week }));
  } catch (err) {
    const msg = err.message || "Có lỗi khi tạo tuần học";
    return res.status(400).json(badRequestResponse(msg));
  }
});

const updateWeek = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.body;

  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json(badRequestResponse("Vui lòng chọn tuần học hợp lệ"));
  }

  if (!startDate && !endDate) {
    return res.status(400).json(badRequestResponse("Cần cung cấp ít nhất một thông tin để cập nhật (ngày bắt đầu hoặc ngày kết thúc)"));
  }

  try {
    const week = await weekService.updateWeek(id, { startDate, endDate });
    return res.json(successResponse("Cập nhật tuần học thành công", { week }));
  } catch (err) {
    const status = err.statusCode || 400;
    const msg = err.message || "Có lỗi khi cập nhật tuần học";
    return res.status(status).json(badRequestResponse(msg));
  }
});

const deleteWeek = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    return res.status(400).json(badRequestResponse("Vui lòng chọn tuần học hợp lệ"));
  }

  try {
    const result = await weekService.deleteWeek(id);
    return res.json(successResponse(result.message, { week: result.deletedWeek }));
  } catch (err) {
    const status = err.statusCode || 400;
    const msg = err.message || "Có lỗi khi xóa tuần học";
    return res.status(status).json(badRequestResponse(msg));
  }
});

module.exports = {
  getWeeks,
  createWeek,
  updateWeek,
  deleteWeek,
};