const mongoose = require('mongoose');
const reportsService = require("../services/reportsService");
const asyncHandler = require("../middleware/asyncHandler");
const {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  serverErrorResponse,
  STATUS_CODES
} = require("../helper/createResponse.helper");
const SchoolYear = require("../models/schoolYearModel");

const isValidObjectId = (id) => {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id);
};

const resolveSchoolYearIdFromQuery = async (schoolYearId, schoolYearLabel) => {
  if (schoolYearId) return schoolYearId;
  if (!schoolYearLabel) return null;
  if (isValidObjectId(schoolYearLabel)) return schoolYearLabel;
  try {
    const sy = await SchoolYear.findOne({
      $or: [
        { year: schoolYearLabel },
        { label: schoolYearLabel }
      ]
    });
    if (sy) return sy._id;
  } catch (err) {
    console.error("resolveSchoolYearIdFromQuery error:", err && (err.stack || err));
  }
  return null;
};

const getTeacherReport = asyncHandler(async (req, res) => {
  const { id: teacherId } = req.params;
  const { type = 'year', schoolYearId, month, weekId, semester, bcNumber } = req.query;
  if (!teacherId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("Vui lòng chọn giáo viên"));
  }
  if (schoolYearId && !isValidObjectId(schoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("Năm học không hợp lệ, vui lòng chọn lại"));
  }
  const filters = { schoolYearId, month, weekId, semester };
  if (type === 'bc' && bcNumber) {
    const result = await reportsService.getBCReport(teacherId, schoolYearId, parseInt(bcNumber));
    if (!result.success) {
      return res.status(result.statusCode || 500).json(result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message));
    }
    return res.json(successResponse("Lấy báo cáo BC thành công", result.data));
  }
  const result = await reportsService.getTeacherReport(teacherId, type, filters);
  if (!result.success) {
    return res.status(result.statusCode || 500).json(result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message));
  }
  return res.json(successResponse("Lấy báo cáo thành công", result.data));
});

const exportReport = asyncHandler(async (req, res) => {
  let { teacherId, teacherIds, schoolYearId, schoolYear, type = 'bc', bcNumber, weekId, weekIds, semester } = req.query;
  const resolvedSchoolYearId = await resolveSchoolYearIdFromQuery(schoolYearId, schoolYear);
  let targetTeacherIds;
  if (teacherIds) {
    try {
      targetTeacherIds = Array.isArray(teacherIds) ? teacherIds : JSON.parse(teacherIds);
    } catch (e) {
      targetTeacherIds = [teacherIds];
    }
  } else if (teacherId) {
    targetTeacherIds = [teacherId];
  } else {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("Vui lòng chọn giáo viên (một hoặc nhiều giáo viên)"));
  }
  if (!resolvedSchoolYearId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("Vui lòng chọn năm học"));
  }
  if (!isValidObjectId(resolvedSchoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("Năm học không hợp lệ, vui lòng chọn lại"));
  }
  const options = { type, schoolYearId: resolvedSchoolYearId };
  if (bcNumber) options.bcNumber = parseInt(bcNumber);
  if (weekId) options.weekId = weekId;
  if (weekIds) {
    try {
      options.weekIds = Array.isArray(weekIds) ? weekIds : JSON.parse(weekIds);
    } catch (e) {
      options.weekIds = [weekIds];
    }
  }
  if (semester) options.semester = parseInt(semester);
  const result = await reportsService.exportReport(targetTeacherIds, resolvedSchoolYearId, options);
  if (!result.success) {
    const statusCode = result.statusCode || 500;
    if (statusCode === 404) {
      return res.status(404).json(notFoundResponse(`${result.message}\n\nChi tiết: xin kiểm tra lại lựa chọn giáo viên, kiểu báo cáo và năm học`));
    }
    return res.status(statusCode).json(serverErrorResponse(result.message));
  }
  const fileName = result.data?.fileName || `BaoCao_${result.data?.schoolYearLabel || resolvedSchoolYearId}`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportMonthReport = asyncHandler(async (req, res) => {
  const { teacherId, teacherIds, schoolYearId, schoolYear, month, bcNumber } = req.query;
  const resolvedSchoolYearId = await resolveSchoolYearIdFromQuery(schoolYearId, schoolYear);
  if (!resolvedSchoolYearId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("Vui lòng chọn năm học"));
  }
  if (!isValidObjectId(resolvedSchoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("Năm học không hợp lệ, vui lòng chọn lại"));
  }
  let targetIds;
  if (teacherIds) {
    try { targetIds = JSON.parse(teacherIds); } catch (e) { targetIds = [teacherId]; }
  } else {
    targetIds = teacherId;
  }
  if (!month && !bcNumber) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("Vui lòng chọn tháng hoặc số báo cáo (bcNumber)"));
  }
  const bc = bcNumber ? parseInt(bcNumber) : parseInt(month);
  const result = await reportsService.exportBCReport(targetIds, resolvedSchoolYearId, bc);
  if (!result.success) {
    return res.status(result.statusCode || 500).json(result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message));
  }
  const fileName = result.data?.fileName || `BC${bc}_${result.data?.schoolYearLabel || resolvedSchoolYearId}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportWeekReport = asyncHandler(async (req, res) => {
  const { teacherId, weekId, weekIds, schoolYearId, schoolYear } = req.query;
  if (!teacherId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("Vui lòng chọn giáo viên"));
  }
  if (!weekId && !weekIds) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("Vui lòng chọn tuần hoặc các tuần cần xuất báo cáo"));
  }
  const resolvedSchoolYearId = await resolveSchoolYearIdFromQuery(schoolYearId, schoolYear);
  if (resolvedSchoolYearId && !isValidObjectId(resolvedSchoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("Năm học không hợp lệ, vui lòng chọn lại"));
  }
  try {
    let result;
    if (weekIds) {
      let weekIdArray;
      try { weekIdArray = JSON.parse(weekIds); } catch (e) { weekIdArray = [weekId]; }
      result = await reportsService.exportWeekRangeReport(teacherId, weekIdArray, resolvedSchoolYearId);
    } else {
      result = await reportsService.exportWeekReport(teacherId, weekId, resolvedSchoolYearId);
    }
    if (!result.success) {
      return res.status(result.statusCode || 500).json(result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message));
    }
    const fileName = result.data?.fileName || `BaoCaoTuan_${result.data?.schoolYearLabel || resolvedSchoolYearId}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    await result.data.workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    return res.status(500).json(serverErrorResponse("Có lỗi khi xuất báo cáo tuần. Vui lòng thử lại sau"));
  }
});

const exportSemesterReport = asyncHandler(async (req, res) => {
  const { teacherId, schoolYearId, schoolYear, semester } = req.query;
  const resolvedSchoolYearId = await resolveSchoolYearIdFromQuery(schoolYearId, schoolYear);
  if (!teacherId || !resolvedSchoolYearId || !semester) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("Vui lòng cung cấp đầy đủ: giáo viên, năm học và học kỳ"));
  }
  if (!isValidObjectId(resolvedSchoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("Năm học không hợp lệ, vui lòng chọn lại"));
  }
  const result = await reportsService.exportSemesterReport(teacherId, resolvedSchoolYearId, parseInt(semester));
  if (!result.success) {
    return res.status(result.statusCode || 500).json(result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message));
  }
  const fileName = result.data?.fileName || `HocKy${semester}_${result.data?.schoolYearLabel || resolvedSchoolYearId}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportYearReport = asyncHandler(async (req, res) => {
  const { teacherId, schoolYearId, schoolYear, allBC } = req.query;
  const resolvedSchoolYearId = await resolveSchoolYearIdFromQuery(schoolYearId, schoolYear);
  if (!teacherId || !resolvedSchoolYearId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("Vui lòng cung cấp giáo viên và năm học"));
  }
  if (!isValidObjectId(resolvedSchoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("Năm học không hợp lệ, vui lòng chọn lại"));
  }
  const result = allBC === 'true'
    ? await reportsService.exportAllBCReport(teacherId, resolvedSchoolYearId)
    : await reportsService.exportYearReport(teacherId, resolvedSchoolYearId);
  if (!result.success) {
    return res.status(result.statusCode || 500).json(result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message));
  }
  const fileName = result.data?.fileName || `BaoCaoNam_${result.data?.schoolYearLabel || resolvedSchoolYearId}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  await result.data.workbook.xlsx.write(res);
  res.end();
});

module.exports = {
  getTeacherReport,
  exportReport,
  exportMonthReport,
  exportWeekReport,
  exportSemesterReport,
  exportYearReport
};