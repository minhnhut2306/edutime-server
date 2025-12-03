const mongoose = require('mongoose');
const reportsService = require("../services/reportsService");
const asyncHandler = require("../middleware/asyncHandler");
const SchoolYear = require("../models/schoolYearModel");
const {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  serverErrorResponse,
  STATUS_CODES
} = require("../helper/createResponse.helper");

const isValidObjectId = (id) => !!(id && mongoose.Types.ObjectId.isValid(id));

const resolveSchoolYearId = async (schoolYearId, schoolYearLabel) => {
  if (schoolYearId) return schoolYearId;
  if (!schoolYearLabel) return null;

  if (isValidObjectId(schoolYearLabel)) return schoolYearLabel;

  try {
    const sy = await SchoolYear.findOne({
      $or: [{ year: schoolYearLabel }, { label: schoolYearLabel }]
    });
    return sy?._id || null;
  } catch (err) {
    return null;
  }
};

const handleServiceResult = (result, res, successMsg) => {
  if (!result.success) {
    const statusCode = result.statusCode || 500;
    if (statusCode === 404) {
      return res.status(404).json(notFoundResponse(result.message));
    }
    return res.status(statusCode).json(serverErrorResponse(result.message));
  }
  return res.json(successResponse(successMsg, result.data));
};

const parseArrayParam = (param) => {
  if (!param) return null;
  if (Array.isArray(param)) return param;
  try {
    return JSON.parse(param);
  } catch (e) {
    return [param];
  }
};

const setExcelHeaders = (res, fileName) => {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
};

const getTeacherReport = asyncHandler(async (req, res) => {
  const { id: teacherId } = req.params;
  const { type = 'year', schoolYearId, month, weekId, semester, bcNumber } = req.query;

  if (!teacherId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("teacherId là bắt buộc")
    );
  }

  if (schoolYearId && !isValidObjectId(schoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("schoolYearId không hợp lệ")
    );
  }

  const filters = { schoolYearId, month, weekId, semester };

  if (type === 'bc' && bcNumber) {
    const result = await reportsService.getBCReport(teacherId, schoolYearId, parseInt(bcNumber));
    return handleServiceResult(result, res, "Lấy báo cáo BC thành công");
  }

  const result = await reportsService.getTeacherReport(teacherId, type, filters);
  return handleServiceResult(result, res, "Lấy báo cáo thành công");
});

const exportReport = asyncHandler(async (req, res) => {
  let { teacherId, teacherIds, schoolYearId, schoolYear, type = 'bc', bcNumber, weekId, weekIds, semester } = req.query;

  const resolvedSchoolYearId = await resolveSchoolYearId(schoolYearId, schoolYear);

  const targetTeacherIds = parseArrayParam(teacherIds) || (teacherId ? [teacherId] : null);

  if (!targetTeacherIds) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("teacherId hoặc teacherIds là bắt buộc")
    );
  }

  if (!resolvedSchoolYearId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("schoolYearId là bắt buộc hoặc không tìm thấy schoolYear tương ứng")
    );
  }

  if (!isValidObjectId(resolvedSchoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("schoolYearId không hợp lệ")
    );
  }

  const options = { type, schoolYearId: resolvedSchoolYearId };
  if (bcNumber) options.bcNumber = parseInt(bcNumber);
  if (weekId) options.weekId = weekId;
  if (weekIds) options.weekIds = parseArrayParam(weekIds);
  if (semester) options.semester = parseInt(semester);

  const result = await reportsService.exportReport(targetTeacherIds, resolvedSchoolYearId, options);

  if (!result.success) {
    const statusCode = result.statusCode || 500;
    if (statusCode === 404) {
      return res.status(404).json(notFoundResponse(result.message));
    }
    return res.status(statusCode).json(serverErrorResponse(result.message));
  }

  const fileName = result.data?.fileName || `BaoCao_${result.data?.schoolYearLabel || resolvedSchoolYearId}`;
  setExcelHeaders(res, fileName);

  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportMonthReport = asyncHandler(async (req, res) => {
  const { teacherId, teacherIds, schoolYearId, schoolYear, month, bcNumber } = req.query;

  const resolvedSchoolYearId = await resolveSchoolYearId(schoolYearId, schoolYear);

  if (!resolvedSchoolYearId || !isValidObjectId(resolvedSchoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("schoolYearId là bắt buộc và phải hợp lệ")
    );
  }

  const targetIds = parseArrayParam(teacherIds) || teacherId;

  if (!month && !bcNumber) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("month hoặc bcNumber là bắt buộc")
    );
  }

  const bc = bcNumber ? parseInt(bcNumber) : parseInt(month);
  const result = await reportsService.exportBCReport(targetIds, resolvedSchoolYearId, bc);

  if (!result.success) {
    return handleServiceResult(result, res, "");
  }

  const fileName = result.data?.fileName || `BC${bc}_${result.data?.schoolYearLabel || resolvedSchoolYearId}.xlsx`;
  setExcelHeaders(res, fileName);

  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportWeekReport = asyncHandler(async (req, res) => {
  const { teacherId, weekId, weekIds, schoolYearId, schoolYear } = req.query;

  if (!teacherId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("teacherId là bắt buộc")
    );
  }
  if (!weekId && !weekIds) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("weekId hoặc weekIds là bắt buộc")
    );
  }

  const resolvedSchoolYearId = await resolveSchoolYearId(schoolYearId, schoolYear);

  if (resolvedSchoolYearId && !isValidObjectId(resolvedSchoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("schoolYearId không hợp lệ")
    );
  }

  const result = weekIds
    ? await reportsService.exportWeekRangeReport(teacherId, parseArrayParam(weekIds), resolvedSchoolYearId)
    : await reportsService.exportWeekReport(teacherId, weekId, resolvedSchoolYearId);

  if (!result.success) {
    return handleServiceResult(result, res, "");
  }

  const fileName = result.data?.fileName || `BaoCaoTuan_${result.data?.schoolYearLabel || resolvedSchoolYearId}.xlsx`;
  setExcelHeaders(res, fileName);

  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportSemesterReport = asyncHandler(async (req, res) => {
  const { teacherId, schoolYearId, schoolYear, semester } = req.query;

  const resolvedSchoolYearId = await resolveSchoolYearId(schoolYearId, schoolYear);

  if (!teacherId || !resolvedSchoolYearId || !semester) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("teacherId, schoolYearId, semester là bắt buộc")
    );
  }

  if (!isValidObjectId(resolvedSchoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("schoolYearId không hợp lệ")
    );
  }

  const result = await reportsService.exportSemesterReport(teacherId, resolvedSchoolYearId, parseInt(semester));

  if (!result.success) {
    return handleServiceResult(result, res, "");
  }

  const fileName = result.data?.fileName || `HocKy${semester}_${result.data?.schoolYearLabel || resolvedSchoolYearId}.xlsx`;
  setExcelHeaders(res, fileName);

  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportYearReport = asyncHandler(async (req, res) => {
  const { teacherId, schoolYearId, schoolYear, allBC } = req.query;

  const resolvedSchoolYearId = await resolveSchoolYearId(schoolYearId, schoolYear);

  if (!teacherId || !resolvedSchoolYearId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("teacherId, schoolYearId là bắt buộc")
    );
  }

  if (!isValidObjectId(resolvedSchoolYearId)) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(
      badRequestResponse("schoolYearId không hợp lệ")
    );
  }

  const result = allBC === 'true' 
    ? await reportsService.exportAllBCReport(teacherId, resolvedSchoolYearId)
    : await reportsService.exportYearReport(teacherId, resolvedSchoolYearId);

  if (!result.success) {
    return handleServiceResult(result, res, "");
  }

  const fileName = result.data?.fileName || `BaoCaoNam_${result.data?.schoolYearLabel || resolvedSchoolYearId}.xlsx`;
  setExcelHeaders(res, fileName);

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