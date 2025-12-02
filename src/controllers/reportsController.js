
const mongoose = require('mongoose');
const reportsService = require("../services/reportsService");
const asyncHandler = require("../middleware/asyncHandler");
const {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  serverErrorResponse,
  STATUS_CODES,
} = require("../helper/createResponse.helper");

const SchoolYear = require("../models/schoolYearModel"); // << added
const isValidObjectId = (id) => {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id);
};

// Helper: try to resolve schoolYearId from either provided schoolYearId or schoolYear label/string
const resolveSchoolYearIdFromQuery = async (schoolYearId, schoolYearLabel) => {
  if (schoolYearId) return schoolYearId;
  if (!schoolYearLabel) return null;

  // If label looks like ObjectId, use it directly
  if (isValidObjectId(schoolYearLabel)) return schoolYearLabel;

  // Try to find SchoolYear by common fields (year or label)
  try {
    const sy = await SchoolYear.findOne({
      $or: [
        { year: schoolYearLabel },
        { label: schoolYearLabel },
      ],
    });
    if (sy) return sy._id;
  } catch (err) {
    console.error("[resolveSchoolYearIdFromQuery] error finding SchoolYear:", err && (err.stack || err));
  }
  return null;
};

const getTeacherReport = asyncHandler(async (req, res) => {
  const { id: teacherId } = req.params;
  const { type = 'year', schoolYearId, month, weekId, semester, bcNumber } = req.query;

  console.log("[getTeacherReport] called", {
    teacherId,
    type,
    schoolYearId,
    month,
    weekId,
    semester,
    bcNumber,
    query: req.query,
  });

  if (!teacherId) {
    console.warn("[getTeacherReport] missing teacherId");
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("teacherId là bắt buộc"));
  }

  if (schoolYearId && !isValidObjectId(schoolYearId)) {
    console.warn("[getTeacherReport] invalid schoolYearId:", schoolYearId);
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("schoolYearId không hợp lệ"));
  }

  const filters = { schoolYearId, month, weekId, semester };

  try {
    if (type === 'bc' && bcNumber) {
      console.log("[getTeacherReport] calling getBCReport with", { teacherId, schoolYearId, bcNumber: parseInt(bcNumber) });
      const result = await reportsService.getBCReport(teacherId, schoolYearId, parseInt(bcNumber));
      if (!result.success) {
        console.warn("[getTeacherReport] getBCReport failed:", result);
        return res.status(result.statusCode || 500).json(
          result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message)
        );
      }
      console.log("[getTeacherReport] getBCReport success:", {
        teacherId,
        schoolYearId,
        bcNumber,
        records: result.data?.records?.length || 0,
      });
      return res.json(successResponse("Lấy báo cáo BC thành công", result.data));
    }

    console.log("[getTeacherReport] calling getTeacherReport with", { teacherId, type, filters });
    const result = await reportsService.getTeacherReport(teacherId, type, filters);
    if (!result.success) {
      console.warn("[getTeacherReport] getTeacherReport failed:", result);
      return res.status(result.statusCode || 500).json(
        result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message)
      );
    }

    console.log("[getTeacherReport] success:", {
      teacherId,
      type,
      schoolYearId,
      records: result.data?.records?.length || 0,
    });
    return res.json(successResponse("Lấy báo cáo thành công", result.data));
  } catch (error) {
    console.error("[getTeacherReport] unexpected error:", error && (error.stack || error));
    return res.status(500).json(serverErrorResponse("Lỗi khi lấy báo cáo: " + (error.message || "")));
  }
});

const exportReport = asyncHandler(async (req, res) => {
  try {
    console.log("[exportReport] req.query:", req.query);

    let { teacherId, teacherIds, schoolYearId, schoolYear, type = 'bc', bcNumber, weekId, weekIds, semester } = req.query;

    // Resolve schoolYearId if caller provided schoolYear (label) instead
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
      console.warn("[exportReport] missing teacherId/teacherIds");
      return res.status(STATUS_CODES.BAD_REQUEST).json(
        badRequestResponse("teacherId hoặc teacherIds là bắt buộc")
      );
    }

    console.log("[exportReport] resolved teacher ids:", targetTeacherIds);

    if (!resolvedSchoolYearId) {
      console.warn("[exportReport] missing/invalid schoolYearId (also tried schoolYear label):", { schoolYearId, schoolYear });
      return res.status(STATUS_CODES.BAD_REQUEST).json(
        badRequestResponse("schoolYearId là bắt buộc (ObjectId của năm học) hoặc không tìm thấy schoolYear tương ứng với label đã cung cấp")
      );
    }

    if (!isValidObjectId(resolvedSchoolYearId)) {
      console.warn("[exportReport] invalid resolvedSchoolYearId:", resolvedSchoolYearId);
      return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("schoolYearId không hợp lệ"));
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

    console.log("[exportReport] calling reportsService.exportReport", { targetTeacherIds, options });

    const result = await reportsService.exportReport(targetTeacherIds, resolvedSchoolYearId, options);

    if (!result.success) {
      console.warn("[exportReport] service returned failure:", result);
      const statusCode = result.statusCode || 500;
      if (statusCode === 404) {
        return res.status(404).json(
          notFoundResponse(`${result.message}\n\nChi tiết: teacherId=${targetTeacherIds.join(',')}, type=${type}, schoolYearId=${resolvedSchoolYearId}`)
        );
      }
      return res.status(statusCode).json(
        serverErrorResponse(result.message)
      );
    }

    const fileName = result.data?.fileName || `BaoCao_${result.data?.schoolYearLabel || resolvedSchoolYearId}`;
    console.log("[exportReport] success, preparing response", {
      teacherCount: targetTeacherIds.length,
      fileName,
      sheetCount: result.data?.sheetCount,
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await result.data.workbook.xlsx.write(res);
    res.end();
    console.log("[exportReport] response sent successfully for file:", fileName);
  } catch (error) {
    console.error("[exportReport] caught error:", error && (error.stack || error));
    const msg = process.env.NODE_ENV === 'development' ? (error.message + "\n" + (error.stack || '')) : "Lỗi xuất báo cáo";
    return res.status(500).json(serverErrorResponse("Lỗi xuất báo cáo: " + msg));
  }
});

const exportMonthReport = asyncHandler(async (req, res) => {
  const { teacherId, teacherIds, schoolYearId, schoolYear, month, bcNumber } = req.query;
  console.log("[exportMonthReport] called", req.query);

  // Try to resolve schoolYearId from label if needed
  const resolvedSchoolYearId = await resolveSchoolYearIdFromQuery(schoolYearId, schoolYear);

  if (!resolvedSchoolYearId) {
    console.warn("[exportMonthReport] missing/invalid schoolYearId");
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("schoolYearId là bắt buộc"));
  }

  if (!isValidObjectId(resolvedSchoolYearId)) {
    console.warn("[exportMonthReport] invalid schoolYearId:", resolvedSchoolYearId);
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("schoolYearId không hợp lệ"));
  }

  let targetIds;
  if (teacherIds) {
    try { targetIds = JSON.parse(teacherIds); } catch (e) { targetIds = [teacherId]; }
  } else {
    targetIds = teacherId;
  }

  if (!month && !bcNumber) {
    console.warn("[exportMonthReport] missing month/bcNumber");
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("month hoặc bcNumber là bắt buộc"));
  }

  const bc = bcNumber ? parseInt(bcNumber) : parseInt(month);
  console.log("[exportMonthReport] calling exportBCReport", { targetIds, schoolYearId: resolvedSchoolYearId, bc });
  const result = await reportsService.exportBCReport(targetIds, resolvedSchoolYearId, bc);

  if (!result.success) {
    console.warn("[exportMonthReport] service failed:", result);
    return res.status(result.statusCode || 500).json(
      result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message)
    );
  }

  const fileName = result.data?.fileName || `BC${bc}_${result.data?.schoolYearLabel || resolvedSchoolYearId}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await result.data.workbook.xlsx.write(res);
  res.end();
  console.log("[exportMonthReport] response sent:", fileName);
});

const exportWeekReport = asyncHandler(async (req, res) => {
  const { teacherId, weekId, weekIds, schoolYearId, schoolYear } = req.query;
  console.log("[exportWeekReport] called", req.query);

  if (!teacherId) {
    console.warn("[exportWeekReport] missing teacherId");
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("teacherId là bắt buộc"));
  }
  if (!weekId && !weekIds) {
    console.warn("[exportWeekReport] missing weekId/weekIds");
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("weekId hoặc weekIds là bắt buộc"));
  }

  const resolvedSchoolYearId = await resolveSchoolYearIdFromQuery(schoolYearId, schoolYear);

  if (resolvedSchoolYearId && !isValidObjectId(resolvedSchoolYearId)) {
    console.warn("[exportWeekReport] invalid schoolYearId:", resolvedSchoolYearId);
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("schoolYearId không hợp lệ"));
  }

  try {
    let result;
    if (weekIds) {
      let weekIdArray;
      try { weekIdArray = JSON.parse(weekIds); } catch (e) { weekIdArray = [weekId]; }
      console.log("[exportWeekReport] calling exportWeekRangeReport", { teacherId, weekIdArray, schoolYearId: resolvedSchoolYearId });
      result = await reportsService.exportWeekRangeReport(teacherId, weekIdArray, resolvedSchoolYearId);
    } else {
      console.log("[exportWeekReport] calling exportWeekReport", { teacherId, weekId, schoolYearId: resolvedSchoolYearId });
      result = await reportsService.exportWeekReport(teacherId, weekId, resolvedSchoolYearId);
    }

    if (!result.success) {
      console.warn("[exportWeekReport] service failed:", result);
      return res.status(result.statusCode || 500).json(
        result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message)
      );
    }

    const fileName = result.data?.fileName || `BaoCaoTuan_${result.data?.schoolYearLabel || resolvedSchoolYearId}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await result.data.workbook.xlsx.write(res);
    res.end();
    console.log("[exportWeekReport] response sent:", fileName);
  } catch (error) {
    console.error("[exportWeekReport] unexpected error:", error && (error.stack || error));
    return res.status(500).json(serverErrorResponse("Lỗi xuất báo cáo tuần: " + (error.message || "")));
  }
});

const exportSemesterReport = asyncHandler(async (req, res) => {
  const { teacherId, schoolYearId, schoolYear, semester } = req.query;
  console.log("[exportSemesterReport] called", req.query);

  const resolvedSchoolYearId = await resolveSchoolYearIdFromQuery(schoolYearId, schoolYear);

  if (!teacherId || !resolvedSchoolYearId || !semester) {
    console.warn("[exportSemesterReport] missing params");
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("teacherId, schoolYearId, semester là bắt buộc"));
  }

  if (!isValidObjectId(resolvedSchoolYearId)) {
    console.warn("[exportSemesterReport] invalid schoolYearId:", resolvedSchoolYearId);
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("schoolYearId không hợp lệ"));
  }

  const result = await reportsService.exportSemesterReport(teacherId, resolvedSchoolYearId, parseInt(semester));

  if (!result.success) {
    console.warn("[exportSemesterReport] service failed:", result);
    return res.status(result.statusCode || 500).json(
      result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message)
    );
  }

  const fileName = result.data?.fileName || `HocKy${semester}_${result.data?.schoolYearLabel || resolvedSchoolYearId}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await result.data.workbook.xlsx.write(res);
  res.end();
  console.log("[exportSemesterReport] response sent:", fileName);
});

const exportYearReport = asyncHandler(async (req, res) => {
  const { teacherId, schoolYearId, schoolYear, allBC } = req.query;
  console.log("[exportYearReport] called", req.query);

  const resolvedSchoolYearId = await resolveSchoolYearIdFromQuery(schoolYearId, schoolYear);

  if (!teacherId || !resolvedSchoolYearId) {
    console.warn("[exportYearReport] missing params");
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("teacherId, schoolYearId là bắt buộc"));
  }

  if (!isValidObjectId(resolvedSchoolYearId)) {
    console.warn("[exportYearReport] invalid schoolYearId:", resolvedSchoolYearId);
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("schoolYearId không hợp lệ"));
  }

  const result = allBC === 'true' 
    ? await reportsService.exportAllBCReport(teacherId, resolvedSchoolYearId)
    : await reportsService.exportYearReport(teacherId, resolvedSchoolYearId);

  if (!result.success) {
    console.warn("[exportYearReport] service failed:", result);
    return res.status(result.statusCode || 500).json(
      result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message)
    );
  }

  const fileName = result.data?.fileName || `BaoCaoNam_${result.data?.schoolYearLabel || resolvedSchoolYearId}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await result.data.workbook.xlsx.write(res);
  res.end();
  console.log("[exportYearReport] response sent:", fileName);
});

module.exports = {
  getTeacherReport,
  exportReport,
  exportMonthReport,
  exportWeekReport,
  exportSemesterReport,
  exportYearReport,
};