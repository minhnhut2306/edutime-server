// controllers/reportsController.js

const reportsService = require("../services/reportsService");
const {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  serverErrorResponse,
} = require("../helper/createResponse.helper");

/**
 * GET /api/reports/teacher/:id
 * Lấy báo cáo theo giáo viên
 * Query params: type (month|week|semester|year), schoolYear, month, weekId, semester
 */
const getTeacherReport = async (req, res) => {
  try {
    const { id: teacherId } = req.params;
    const { type, schoolYear, month, weekId, semester } = req.query;

    // Validation
    if (!teacherId) {
      return res
        .status(400)
        .json(badRequestResponse("teacherId là bắt buộc"));
    }

    if (!type) {
      return res
        .status(400)
        .json(badRequestResponse("type là bắt buộc (month|week|semester|year)"));
    }

    const validTypes = ["month", "week", "semester", "year"];
    if (!validTypes.includes(type)) {
      return res
        .status(400)
        .json(badRequestResponse("type không hợp lệ"));
    }

    // Validate theo từng type
    if (type === "month" && (!schoolYear || !month)) {
      return res
        .status(400)
        .json(badRequestResponse("schoolYear và month là bắt buộc cho báo cáo tháng"));
    }

    if (type === "week" && !weekId) {
      return res
        .status(400)
        .json(badRequestResponse("weekId là bắt buộc cho báo cáo tuần"));
    }

    if (type === "semester" && (!schoolYear || !semester)) {
      return res
        .status(400)
        .json(badRequestResponse("schoolYear và semester là bắt buộc cho báo cáo học kỳ"));
    }

    if (type === "year" && !schoolYear) {
      return res
        .status(400)
        .json(badRequestResponse("schoolYear là bắt buộc cho báo cáo năm"));
    }

    // Gọi service
    const filters = { schoolYear, month, weekId, semester };
    const result = await reportsService.getTeacherReport(
      teacherId,
      type,
      filters
    );

    // Xử lý kết quả
    if (!result.success) {
      const statusCode = result.statusCode || 500;

      if (statusCode === 404) {
        return res.status(404).json(notFoundResponse(result.message));
      }

      if (statusCode === 400) {
        return res.status(400).json(badRequestResponse(result.message));
      }

      return res.status(statusCode).json(serverErrorResponse(result.message));
    }

    return res.json(
      successResponse("Lấy báo cáo thành công", result.data)
    );
  } catch (error) {
    console.error("Error in getTeacherReport controller:", error);
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi khi lấy báo cáo"));
  }
};

/**
 * GET /api/reports/export/month
 * Xuất báo cáo tháng ra Excel
 * Query params: teacherId, schoolYear, month
 */
const exportMonthReport = async (req, res) => {
  try {
    const { teacherId, schoolYear, month } = req.query;

    // Validation
    if (!teacherId || !schoolYear || !month) {
      return res
        .status(400)
        .json(badRequestResponse("teacherId, schoolYear và month là bắt buộc"));
    }

    // Gọi service
    const result = await reportsService.exportMonthReport(
      teacherId,
      schoolYear,
      month
    );

    // Xử lý kết quả
    if (!result.success) {
      const statusCode = result.statusCode || 500;

      if (statusCode === 404) {
        return res.status(404).json(notFoundResponse(result.message));
      }

      return res.status(statusCode).json(serverErrorResponse(result.message));
    }

    // Xuất file Excel
    const workbook = result.data.workbook;
    const fileName = `BaoCaoThang_${month}_${schoolYear}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error in exportMonthReport controller:", error);
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi khi xuất báo cáo Excel"));
  }
};

/**
 * GET /api/reports/export/week
 * Xuất báo cáo tuần ra Excel
 * Query params: teacherId, weekId
 */
const exportWeekReport = async (req, res) => {
  try {
    const { teacherId, weekId } = req.query;

    // Validation
    if (!teacherId || !weekId) {
      return res
        .status(400)
        .json(badRequestResponse("teacherId và weekId là bắt buộc"));
    }

    // Gọi service
    const result = await reportsService.exportWeekReport(teacherId, weekId);

    // Xử lý kết quả
    if (!result.success) {
      const statusCode = result.statusCode || 500;

      if (statusCode === 404) {
        return res.status(404).json(notFoundResponse(result.message));
      }

      return res.status(statusCode).json(serverErrorResponse(result.message));
    }

    // Xuất file Excel
    const workbook = result.data.workbook;
    const fileName = `BaoCaoTuan_${weekId}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error in exportWeekReport controller:", error);
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi khi xuất báo cáo Excel"));
  }
};

/**
 * GET /api/reports/export/semester
 * Xuất báo cáo học kỳ ra Excel
 * Query params: teacherId, schoolYear, semester
 */
const exportSemesterReport = async (req, res) => {
  try {
    const { teacherId, schoolYear, semester } = req.query;

    // Validation
    if (!teacherId || !schoolYear || !semester) {
      return res
        .status(400)
        .json(badRequestResponse("teacherId, schoolYear và semester là bắt buộc"));
    }

    // Gọi service
    const result = await reportsService.exportSemesterReport(
      teacherId,
      schoolYear,
      semester
    );

    // Xử lý kết quả
    if (!result.success) {
      const statusCode = result.statusCode || 500;

      if (statusCode === 404) {
        return res.status(404).json(notFoundResponse(result.message));
      }

      return res.status(statusCode).json(serverErrorResponse(result.message));
    }

    // Xuất file Excel
    const workbook = result.data.workbook;
    const fileName = `BaoCaoHocKy${semester}_${schoolYear}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error in exportSemesterReport controller:", error);
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi khi xuất báo cáo Excel"));
  }
};

/**
 * GET /api/reports/export/year
 * Xuất báo cáo năm ra Excel
 * Query params: teacherId, schoolYear
 */
const exportYearReport = async (req, res) => {
  try {
    const { teacherId, schoolYear } = req.query;

    // Validation
    if (!teacherId || !schoolYear) {
      return res
        .status(400)
        .json(badRequestResponse("teacherId và schoolYear là bắt buộc"));
    }

    // Gọi service
    const result = await reportsService.exportYearReport(
      teacherId,
      schoolYear
    );

    // Xử lý kết quả
    if (!result.success) {
      const statusCode = result.statusCode || 500;

      if (statusCode === 404) {
        return res.status(404).json(notFoundResponse(result.message));
      }

      return res.status(statusCode).json(serverErrorResponse(result.message));
    }

    // Xuất file Excel
    const workbook = result.data.workbook;
    const fileName = `BaoCaoNam_${schoolYear}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error in exportYearReport controller:", error);
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi khi xuất báo cáo Excel"));
  }
};

module.exports = {
  getTeacherReport,
  exportMonthReport,
  exportWeekReport,
  exportSemesterReport,
  exportYearReport,
};