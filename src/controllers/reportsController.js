const reportsService = require("../services/reportsService");
const asyncHandler = require("../middleware/asyncHandler");
const {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  serverErrorResponse,
  STATUS_CODES,
} = require("../helper/createResponse.helper");

const getTeacherReport = asyncHandler(async (req, res) => {
  const { id: teacherId } = req.params;
  const { type = 'year', schoolYearId, month, weekId, semester, bcNumber } = req.query;

  if (!teacherId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("teacherId là bắt buộc"));
  }

  const filters = { schoolYearId, month, weekId, semester };
  
  if (type === 'bc' && bcNumber) {
    const result = await reportsService.getBCReport(teacherId, schoolYearId, parseInt(bcNumber));
    if (!result.success) {
      return res.status(result.statusCode || 500).json(
        result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message)
      );
    }
    return res.json(successResponse("Lấy báo cáo BC thành công", result.data));
  }

  const result = await reportsService.getTeacherReport(teacherId, type, filters);
  if (!result.success) {
    return res.status(result.statusCode || 500).json(
      result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message)
    );
  }

  return res.json(successResponse("Lấy báo cáo thành công", result.data));
});

const exportReport = asyncHandler(async (req, res) => {
  try {
    const { teacherId, teacherIds, schoolYearId, type = 'bc', bcNumber, weekId, weekIds, semester } = req.query;

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
      return res.status(STATUS_CODES.BAD_REQUEST).json(
        badRequestResponse("teacherId hoặc teacherIds là bắt buộc")
      );
    }

    if (!schoolYearId) {
      return res.status(STATUS_CODES.BAD_REQUEST).json(
        badRequestResponse("schoolYearId là bắt buộc (VD: 2024-2025)")
      );
    }

    const options = { type };
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

    const result = await reportsService.exportReport(targetTeacherIds, schoolYearId, options);

    if (!result.success) {
      const statusCode = result.statusCode || 500;
      if (statusCode === 404) {
        return res.status(404).json(
          notFoundResponse(`${result.message}\n\nChi tiết: teacherId=${targetTeacherIds.join(',')}, type=${type}, schoolYearId=${schoolYearId}`)
        );
      }
      return res.status(statusCode).json(
        serverErrorResponse(result.message)
      );
    }

    let fileName = `BaoCao_${schoolYearId}`;
    if (type === 'bc' && bcNumber) fileName = `BC${bcNumber}_${schoolYearId}`;
    else if (type === 'week') fileName = `BaoCaoTuan_${schoolYearId}`;
    else if (type === 'semester') fileName = `HocKy${semester}_${schoolYearId}`;
    else if (type === 'year') fileName = `CaNam_${schoolYearId}`;
    
    if (targetTeacherIds.length > 1) fileName += `_${targetTeacherIds.length}GV`;
    fileName += '.xlsx';

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await result.data.workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    return res.status(500).json(
      serverErrorResponse("Lỗi xuất báo cáo: " + error.message)
    );
  }
});

const exportMonthReport = asyncHandler(async (req, res) => {
  const { teacherId, teacherIds, schoolYearId, month, bcNumber } = req.query;
  
  if (!schoolYearId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("schoolYearId là bắt buộc"));
  }
  
  let targetIds;
  if (teacherIds) {
    try { targetIds = JSON.parse(teacherIds); } catch (e) { targetIds = [teacherId]; }
  } else {
    targetIds = teacherId;
  }

  if (!month && !bcNumber) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("month hoặc bcNumber là bắt buộc"));
  }

  const bc = bcNumber ? parseInt(bcNumber) : parseInt(month);
  const result = await reportsService.exportBCReport(targetIds, schoolYearId, bc);

  if (!result.success) {
    return res.status(result.statusCode || 500).json(
      result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message)
    );
  }

  const fileName = `BC${bc}_${schoolYearId}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportWeekReport = asyncHandler(async (req, res) => {
  const { teacherId, weekId, weekIds, schoolYearId } = req.query;

  if (!teacherId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("teacherId là bắt buộc"));
  }
  if (!weekId && !weekIds) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("weekId hoặc weekIds là bắt buộc"));
  }

  if (!schoolYearId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("schoolYearId là bắt buộc"));
  }

  let result;
  if (weekIds) {
    let weekIdArray;
    try { weekIdArray = JSON.parse(weekIds); } catch (e) { weekIdArray = [weekId]; }
    result = await reportsService.exportWeekRangeReport(teacherId, weekIdArray, schoolYearId);
  } else {
    result = await reportsService.exportWeekReport(teacherId, weekId, schoolYearId);
  }

  if (!result.success) {
    return res.status(result.statusCode || 500).json(
      result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message)
    );
  }

  const fileName = `BaoCaoTuan_${schoolYearId}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportSemesterReport = asyncHandler(async (req, res) => {
  const { teacherId, schoolYearId, semester } = req.query;

  if (!teacherId || !schoolYearId || !semester) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("teacherId, schoolYearId, semester là bắt buộc"));
  }

  const result = await reportsService.exportSemesterReport(teacherId, schoolYearId, parseInt(semester));

  if (!result.success) {
    return res.status(result.statusCode || 500).json(
      result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message)
    );
  }

  const fileName = `HocKy${semester}_${schoolYearId}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportYearReport = asyncHandler(async (req, res) => {
  const { teacherId, schoolYearId, allBC } = req.query;

  if (!teacherId || !schoolYearId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("teacherId, schoolYearId là bắt buộc"));
  }

  const result = allBC === 'true' 
    ? await reportsService.exportAllBCReport(teacherId, schoolYearId)
    : await reportsService.exportYearReport(teacherId, schoolYearId);

  if (!result.success) {
    return res.status(result.statusCode || 500).json(
      result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message)
    );
  }

  const fileName = `BaoCaoNam_${schoolYearId}.xlsx`;
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
  exportYearReport,
};