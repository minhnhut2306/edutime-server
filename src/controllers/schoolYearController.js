// src/controllers/schoolYear.controller.js
const schoolYearService = require('../services/schoolYearService');
const {
  successResponse,
  createdResponse,
  notFoundResponse,
  badRequestResponse,
  forbiddenResponse,
  serverErrorResponse
} = require('../helper/createResponse.helper');

class SchoolYearController {
  /**
   * GET /api/school-years
   * Lấy danh sách năm học
   */
  async getSchoolYears(req, res) {
    try {
      const years = await schoolYearService.getSchoolYears();
      res.status(200).json(successResponse('Lấy danh sách năm học thành công', { years }));
    } catch (error) {
      console.error('getSchoolYears error:', error);
      res.status(500).json(serverErrorResponse(error.message));
    }
  }

  /**
   * GET /api/school-years/active
   * Lấy năm học đang active
   */
  async getActiveSchoolYear(req, res) {
    try {
      const activeYear = await schoolYearService.getActiveSchoolYear();

      if (!activeYear) {
        return res.status(404).json(notFoundResponse('Không có năm học đang hoạt động'));
      }

      res.status(200).json(successResponse('Lấy năm học active thành công', { schoolYear: activeYear }));
    } catch (error) {
      console.error('getActiveSchoolYear error:', error);
      res.status(500).json(serverErrorResponse(error.message));
    }
  }

  /**
   * GET /api/school-years/:year
   * Lấy data của năm học cụ thể
   */
  async getSchoolYearData(req, res) {
    try {
      const { year } = req.params;
      const data = await schoolYearService.getSchoolYearData(year);

      if (!data) {
        return res.status(404).json(notFoundResponse('Không tìm thấy năm học'));
      }

      res.status(200).json(successResponse('Lấy dữ liệu năm học thành công', { schoolYear: data }));
    } catch (error) {
      console.error('getSchoolYearData error:', error);
      res.status(500).json(serverErrorResponse(error.message));
    }
  }

  /**
   * POST /api/school-years
   * Tạo năm học mới
   */
  async createSchoolYear(req, res) {
    try {
      const { year } = req.body;

      if (!year) {
        return res.status(400).json(badRequestResponse('Vui lòng cung cấp năm học'));
      }

      // Validate format năm học: 2024-2025
      const yearPattern = /^\d{4}-\d{4}$/;
      if (!yearPattern.test(year)) {
        return res.status(400).json(
          badRequestResponse('Định dạng năm học không hợp lệ (VD: 2024-2025)')
        );
      }

      // Validate năm học phải liên tiếp
      const [startYear, endYear] = year.split('-').map(Number);
      if (endYear !== startYear + 1) {
        return res.status(400).json(
          badRequestResponse('Năm học phải liên tiếp nhau (VD: 2024-2025)')
        );
      }

      // Check quyền admin
      if (req.user?.role !== 'admin') {
        return res.status(403).json(forbiddenResponse('Chỉ Admin mới có quyền tạo năm học'));
      }

      const schoolYear = await schoolYearService.createSchoolYear(year);

      res.status(201).json(createdResponse('Tạo năm học thành công', { schoolYear }));
    } catch (error) {
      console.error('createSchoolYear error:', error);
      res.status(500).json(serverErrorResponse(error.message));
    }
  }

  /**
   * POST /api/school-years/finish
   * Kết thúc năm học hiện tại và tạo năm mới
   */
  async finishSchoolYear(req, res) {
    try {
      const { currentYear } = req.body;

      if (!currentYear) {
        return res.status(400).json(badRequestResponse('Vui lòng cung cấp năm học hiện tại'));
      }

      // Check admin permission
      if (req.user?.role !== 'admin') {
        return res.status(403).json(forbiddenResponse('Chỉ Admin mới có quyền kết thúc năm học'));
      }

      const result = await schoolYearService.finishSchoolYear(currentYear);

      res.status(200).json(
        successResponse(
          `Đã kết thúc năm học ${result.archivedYear}. Năm học mới: ${result.newYear}`,
          result
        )
      );
    } catch (error) {
      console.error('finishSchoolYear error:', error);
      res.status(400).json(badRequestResponse(error.message));
    }
  }

  /**
   * DELETE /api/school-years/:year
   * Xóa năm học (chỉ admin)
   */
  async deleteSchoolYear(req, res) {
    try {
      const { year } = req.params;

      // Check admin permission
      if (req.user?.role !== 'admin') {
        return res.status(403).json(forbiddenResponse('Chỉ Admin mới có quyền xóa năm học'));
      }

      await schoolYearService.deleteSchoolYear(year);

      res.status(200).json(successResponse(`Đã xóa năm học ${year} và toàn bộ dữ liệu liên quan`));
    } catch (error) {
      console.error('deleteSchoolYear error:', error);
      res.status(400).json(badRequestResponse(error.message));
    }
  }
}

module.exports = new SchoolYearController();