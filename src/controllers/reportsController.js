const reportsService = require("../services/reportsService");
const asyncHandler = require("../middleware/asyncHandler");
const {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  serverErrorResponse,
  STATUS_CODES,
} = require("../helper/createResponse.helper");

const VALID_TYPES = ["month", "week", "semester", "year", "bc"];
const getTeacherReport = asyncHandler(async (req, res) => {
  const { id: teacherId } = req.params;
  const { type, schoolYear, month, weekId, semester, bcNumber } = req.query;

  if (!teacherId) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json(badRequestResponse("teacherId là bắt buộc"));
  }

  if (!type) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json(badRequestResponse("type là bắt buộc (month|week|semester|year|bc)"));
  }

  if (!VALID_TYPES.includes(type)) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json(badRequestResponse("type không hợp lệ"));
  }

  // Validation cho type BC
  if (type === "bc" && (!schoolYear || !bcNumber)) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json(badRequestResponse("schoolYear và bcNumber là bắt buộc cho báo cáo BC"));
  }

  if (type === "month" && (!schoolYear || !month)) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json(badRequestResponse("schoolYear và month là bắt buộc cho báo cáo tháng"));
  }

  if (type === "week" && !weekId) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json(badRequestResponse("weekId là bắt buộc cho báo cáo tuần"));
  }

  if (type === "semester" && (!schoolYear || !semester)) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json(badRequestResponse("schoolYear và semester là bắt buộc cho báo cáo học kỳ"));
  }

  if (type === "year" && !schoolYear) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json(badRequestResponse("schoolYear là bắt buộc cho báo cáo năm"));
  }

  // Xử lý BC report
  if (type === "bc") {
    const result = await reportsService.getBCReport(
      teacherId,
      schoolYear,
      parseInt(bcNumber)
    );

    if (!result.success) {
      const statusCode = result.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;
      if (statusCode === STATUS_CODES.NOT_FOUND) {
        return res.status(STATUS_CODES.NOT_FOUND).json(notFoundResponse(result.message));
      }
      return res.status(statusCode).json(serverErrorResponse(result.message));
    }

    return res.json(successResponse("Lấy báo cáo BC thành công", result.data));
  }

  // Xử lý các loại report cũ
  const filters = { schoolYear, month, weekId, semester };
  const result = await reportsService.getTeacherReport(
    teacherId,
    type,
    filters
  );

  if (!result.success) {
    const statusCode = result.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;

    if (statusCode === STATUS_CODES.NOT_FOUND) {
      return res.status(STATUS_CODES.NOT_FOUND).json(notFoundResponse(result.message));
    }

    if (statusCode === STATUS_CODES.BAD_REQUEST) {
      return res.status(STATUS_CODES.BAD_REQUEST).json(badRequestResponse(result.message));
    }

    return res.status(statusCode).json(serverErrorResponse(result.message));
  }

  return res.json(
    successResponse("Lấy báo cáo thành công", result.data)
  );
});

/**
 * Xuất Excel báo cáo theo tháng
 * Hỗ trợ thêm: bcNumber để xuất theo BC thay vì tháng
 */
const exportMonthReport = asyncHandler(async (req, res) => {
  const { teacherId, schoolYear, month, bcNumber } = req.query;

  if (!teacherId || !schoolYear) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json(badRequestResponse("teacherId và schoolYear là bắt buộc"));
  }

  // Nếu có bcNumber → xuất theo BC
  if (bcNumber) {
    const result = await reportsService.exportBCReport(
      teacherId,
      schoolYear,
      parseInt(bcNumber)
    );

    if (!result.success) {
      const statusCode = result.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;
      if (statusCode === STATUS_CODES.NOT_FOUND) {
        return res.status(STATUS_CODES.NOT_FOUND).json(notFoundResponse(result.message));
      }
      return res.status(statusCode).json(serverErrorResponse(result.message));
    }

    const workbook = result.data.workbook;
    const fileName = `BaoCao_BC${bcNumber}_${schoolYear}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    return res.end();
  }

  // Xuất theo tháng (legacy)
  if (!month) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json(badRequestResponse("month hoặc bcNumber là bắt buộc"));
  }

  const result = await reportsService.exportMonthReport(
    teacherId,
    schoolYear,
    month
  );

  if (!result.success) {
    const statusCode = result.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;

    if (statusCode === STATUS_CODES.NOT_FOUND) {
      return res.status(STATUS_CODES.NOT_FOUND).json(notFoundResponse(result.message));
    }

    return res.status(statusCode).json(serverErrorResponse(result.message));
  }

  const workbook = result.data.workbook;
  const fileName = `BaoCaoThang_${month}_${schoolYear}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await workbook.xlsx.write(res);
  res.end();
});

/**
 * Xuất Excel báo cáo theo tuần
 * Hỗ trợ: 
 * - weekId: 1 tuần đơn lẻ
 * - weekIds: nhiều tuần (tự động group theo BC)
 */
const exportWeekReport = asyncHandler(async (req, res) => {
  const { teacherId, weekId, weekIds } = req.query;

  if (!teacherId) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json(badRequestResponse("teacherId là bắt buộc"));
  }

  // Nếu có weekIds (nhiều tuần) → tự động group theo BC
  if (weekIds) {
    let weekIdArray;
    try {
      weekIdArray = Array.isArray(weekIds) ? weekIds : JSON.parse(weekIds);
    } catch (error) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json(badRequestResponse("weekIds phải là mảng JSON hợp lệ"));
    }

    if (!Array.isArray(weekIdArray) || weekIdArray.length === 0) {
      return res
        .status(STATUS_CODES.BAD_REQUEST)
        .json(badRequestResponse("weekIds phải là mảng không rỗng"));
    }

    const result = await reportsService.exportWeekRangeReport(
      teacherId,
      weekIdArray
    );

    if (!result.success) {
      const statusCode = result.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;
      if (statusCode === STATUS_CODES.NOT_FOUND) {
        return res.status(STATUS_CODES.NOT_FOUND).json(notFoundResponse(result.message));
      }
      return res.status(statusCode).json(serverErrorResponse(result.message));
    }

    const workbook = result.data.workbook;
    const bcInfo = result.data.bcInfo;
    
    // Tên file dựa vào số BC
    let fileName;
    if (bcInfo.length === 1) {
      const weeks = bcInfo[0].weeks.map(w => w.weekNumber).join('-');
      fileName = `BaoCao_BC${bcInfo[0].bcNumber}_Tuan${weeks}.xlsx`;
    } else {
      const bcNumbers = bcInfo.map(bc => bc.bcNumber).join('-');
      fileName = `BaoCao_BC${bcNumbers}_NhieuThang.xlsx`;
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    return res.end();
  }

  // Xuất 1 tuần đơn lẻ (legacy)
  if (!weekId) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json(badRequestResponse("weekId hoặc weekIds là bắt buộc"));
  }

  const result = await reportsService.exportWeekReport(teacherId, weekId);

  if (!result.success) {
    const statusCode = result.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;

    if (statusCode === STATUS_CODES.NOT_FOUND) {
      return res.status(STATUS_CODES.NOT_FOUND).json(notFoundResponse(result.message));
    }

    return res.status(statusCode).json(serverErrorResponse(result.message));
  }

  const workbook = result.data.workbook;
  const fileName = `BaoCaoTuan_${weekId}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await workbook.xlsx.write(res);
  res.end();
});

const exportSemesterReport = asyncHandler(async (req, res) => {
  const { teacherId, schoolYear, semester } = req.query;

  if (!teacherId || !schoolYear || !semester) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json(badRequestResponse("teacherId, schoolYear và semester là bắt buộc"));
  }

  const result = await reportsService.exportSemesterReport(
    teacherId,
    schoolYear,
    semester
  );

  if (!result.success) {
    const statusCode = result.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;

    if (statusCode === STATUS_CODES.NOT_FOUND) {
      return res.status(STATUS_CODES.NOT_FOUND).json(notFoundResponse(result.message));
    }

    return res.status(statusCode).json(serverErrorResponse(result.message));
  }

  const workbook = result.data.workbook;
  const fileName = `BaoCaoHocKy${semester}_${schoolYear}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await workbook.xlsx.write(res);
  res.end();
});

/**
 * Xuất Excel báo cáo năm
 * Hỗ trợ thêm: allBC=true để xuất tất cả BC trong năm
 */
const exportYearReport = asyncHandler(async (req, res) => {
  const { teacherId, schoolYear, allBC } = req.query;

  if (!teacherId || !schoolYear) {
    return res
      .status(STATUS_CODES.BAD_REQUEST)
      .json(badRequestResponse("teacherId và schoolYear là bắt buộc"));
  }

  // Nếu có allBC=true → xuất tất cả BC
  if (allBC === 'true' || allBC === true) {
    const result = await reportsService.exportAllBCReport(teacherId, schoolYear);

    if (!result.success) {
      const statusCode = result.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;
      if (statusCode === STATUS_CODES.NOT_FOUND) {
        return res.status(STATUS_CODES.NOT_FOUND).json(notFoundResponse(result.message));
      }
      return res.status(statusCode).json(serverErrorResponse(result.message));
    }

    const workbook = result.data.workbook;
    const fileName = `BaoCaoTongHopBC_${schoolYear}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    return res.end();
  }

  // Xuất báo cáo năm (legacy)
  const result = await reportsService.exportYearReport(
    teacherId,
    schoolYear
  );

  if (!result.success) {
    const statusCode = result.statusCode || STATUS_CODES.INTERNAL_SERVER_ERROR;

    if (statusCode === STATUS_CODES.NOT_FOUND) {
      return res.status(STATUS_CODES.NOT_FOUND).json(notFoundResponse(result.message));
    }

    return res.status(statusCode).json(serverErrorResponse(result.message));
  }

  const workbook = result.data.workbook;
  const fileName = `BaoCaoNam_${schoolYear}.xlsx`;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await workbook.xlsx.write(res);
  res.end();
});

module.exports = {
  getTeacherReport,
  exportMonthReport,
  exportWeekReport,
  exportSemesterReport,
  exportYearReport,
};