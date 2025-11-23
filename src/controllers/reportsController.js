// ==================== UPDATED: src/controllers/reportsController.js ====================

const reportsService = require("../services/reportsService");
const asyncHandler = require("../middleware/asyncHandler");
const {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  serverErrorResponse,
  STATUS_CODES,
} = require("../helper/createResponse.helper");

/**
 * Lấy báo cáo giáo viên (JSON)
 * GET /api/reports/teacher/:id?type=...&schoolYear=...
 */
const getTeacherReport = asyncHandler(async (req, res) => {
  const { id: teacherId } = req.params;
  const { type = 'year', schoolYear, month, weekId, semester, bcNumber } = req.query;

  if (!teacherId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("teacherId là bắt buộc"));
  }

  const filters = { schoolYear, month, weekId, semester };
  
  if (type === 'bc' && bcNumber) {
    const result = await reportsService.getBCReport(teacherId, schoolYear, parseInt(bcNumber));
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

/**
 * ✅ FIX: Xuất Excel - UNIFIED ENDPOINT - LẤY SCHOOLYEAR TỪ QUERY
 * GET /api/reports/export?teacherId=...&schoolYear=...&type=...&weekId=...
 */
const exportReport = asyncHandler(async (req, res) => {
  try {
    // ✅ DEBUG INFO
    console.log("🎯 exportReport CONTROLLER CALLED");
    console.log("📋 Query params:", req.query);
    console.log("👤 User info:", {
      userId: req.userId,
      email: req.user?.email,
      role: req.user?.role
    });

    const { teacherId, teacherIds, schoolYear, type = 'bc', bcNumber, weekId, weekIds, semester } = req.query;

    // ✅ Xử lý teacherId/teacherIds
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

    // ✅ KIỂM TRA SCHOOLYEAR - BẮT BUỘC PHẢI CÓ
    if (!schoolYear) {
      return res.status(STATUS_CODES.BAD_REQUEST).json(
        badRequestResponse("schoolYear là bắt buộc (VD: 2024-2025)")
      );
    }

    console.log("📊 Export Debug Info:", {
      targetTeacherIds,
      schoolYear,
      type,
      bcNumber,
      weekId,
      weekIds,
      semester
    });

    // Build options
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

    // ✅ Gọi service với schoolYear từ query
    const result = await reportsService.exportReport(targetTeacherIds, schoolYear, options);

    console.log("📊 Export Result:", {
      success: result.success,
      statusCode: result.statusCode,
      message: result.message,
      hasWorkbook: !!result.data?.workbook
    });

    if (!result.success) {
      const statusCode = result.statusCode || 500;
      if (statusCode === 404) {
        return res.status(404).json(
          notFoundResponse(`${result.message}\n\nChi tiết: teacherId=${targetTeacherIds.join(',')}, type=${type}, schoolYear=${schoolYear}`)
        );
      }
      return res.status(statusCode).json(
        serverErrorResponse(result.message)
      );
    }

    // Build filename
    let fileName = `BaoCao_${schoolYear}`;
    if (type === 'bc' && bcNumber) fileName = `BC${bcNumber}_${schoolYear}`;
    else if (type === 'week') fileName = `BaoCaoTuan_${schoolYear}`;
    else if (type === 'semester') fileName = `HocKy${semester}_${schoolYear}`;
    else if (type === 'year') fileName = `CaNam_${schoolYear}`;
    
    if (targetTeacherIds.length > 1) fileName += `_${targetTeacherIds.length}GV`;
    fileName += '.xlsx';

    console.log("📥 Sending file:", fileName);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await result.data.workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("❌ exportReport ERROR:", error);
    return res.status(500).json(
      serverErrorResponse("Lỗi xuất báo cáo: " + error.message)
    );
  }
});

// ==================== BACKWARD COMPATIBLE ENDPOINTS ====================

const exportMonthReport = asyncHandler(async (req, res) => {
  const { teacherId, teacherIds, schoolYear, month, bcNumber } = req.query;
  
  // ✅ KIỂM TRA SCHOOLYEAR
  if (!schoolYear) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("schoolYear là bắt buộc"));
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
  const result = await reportsService.exportBCReport(targetIds, schoolYear, bc);

  if (!result.success) {
    return res.status(result.statusCode || 500).json(
      result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message)
    );
  }

  const fileName = `BC${bc}_${schoolYear}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportWeekReport = asyncHandler(async (req, res) => {
  const { teacherId, weekId, weekIds, schoolYear } = req.query;

  if (!teacherId) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("teacherId là bắt buộc"));
  }
  if (!weekId && !weekIds) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("weekId hoặc weekIds là bắt buộc"));
  }

  // ✅ KIỂM TRA SCHOOLYEAR
  if (!schoolYear) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("schoolYear là bắt buộc"));
  }

  let result;
  if (weekIds) {
    let weekIdArray;
    try { weekIdArray = JSON.parse(weekIds); } catch (e) { weekIdArray = [weekId]; }
    result = await reportsService.exportWeekRangeReport(teacherId, weekIdArray, schoolYear);
  } else {
    result = await reportsService.exportWeekReport(teacherId, weekId, schoolYear);
  }

  if (!result.success) {
    return res.status(result.statusCode || 500).json(
      result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message)
    );
  }

  const fileName = `BaoCaoTuan_${schoolYear}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportSemesterReport = asyncHandler(async (req, res) => {
  const { teacherId, schoolYear, semester } = req.query;

  if (!teacherId || !schoolYear || !semester) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("teacherId, schoolYear, semester là bắt buộc"));
  }

  const result = await reportsService.exportSemesterReport(teacherId, schoolYear, parseInt(semester));

  if (!result.success) {
    return res.status(result.statusCode || 500).json(
      result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message)
    );
  }

  const fileName = `HocKy${semester}_${schoolYear}.xlsx`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await result.data.workbook.xlsx.write(res);
  res.end();
});

const exportYearReport = asyncHandler(async (req, res) => {
  const { teacherId, schoolYear, allBC } = req.query;

  if (!teacherId || !schoolYear) {
    return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse("teacherId, schoolYear là bắt buộc"));
  }

  const result = allBC === 'true' 
    ? await reportsService.exportAllBCReport(teacherId, schoolYear)
    : await reportsService.exportYearReport(teacherId, schoolYear);

  if (!result.success) {
    return res.status(result.statusCode || 500).json(
      result.statusCode === 404 ? notFoundResponse(result.message) : serverErrorResponse(result.message)
    );
  }

  const fileName = `BaoCaoNam_${schoolYear}.xlsx`;
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