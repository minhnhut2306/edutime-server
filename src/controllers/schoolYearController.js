const schoolYearService = require('../services/schoolYearService');
const asyncHandler = require('../middleware/asyncHandler');
const {
  successResponse,
  createdResponse,
  notFoundResponse,
  badRequestResponse,
  forbiddenResponse
} = require('../helper/createResponse.helper');

const getSchoolYears = asyncHandler(async (req, res) => {
  const years = await schoolYearService.getSchoolYears();
  return res.status(200).json(successResponse('Lấy danh sách năm học thành công', { years }));
});

const getActiveSchoolYear = asyncHandler(async (req, res) => {
  const activeYear = await schoolYearService.getActiveSchoolYear();

  if (!activeYear) {
    return res.status(404).json(notFoundResponse('Không có năm học đang hoạt động'));
  }

  return res.status(200).json(successResponse('Lấy năm học active thành công', { schoolYear: activeYear }));
});

const getSchoolYearData = asyncHandler(async (req, res) => {
  const { year } = req.params;
  const data = await schoolYearService.getSchoolYearData(year);

  if (!data) {
    return res.status(404).json(notFoundResponse('Không tìm thấy năm học'));
  }

  return res.status(200).json(successResponse('Lấy dữ liệu năm học thành công', { schoolYear: data }));
});

const createSchoolYear = asyncHandler(async (req, res) => {
  const { year } = req.body;

  if (!year) {
    return res.status(400).json(badRequestResponse('Vui lòng cung cấp năm học'));
  }

  const yearPattern = /^\d{4}-\d{4}$/;
  if (!yearPattern.test(year)) {
    return res.status(400).json(
      badRequestResponse('Định dạng năm học không hợp lệ (VD: 2024-2025)')
    );
  }

  const [startYear, endYear] = year.split('-').map(Number);
  if (endYear !== startYear + 1) {
    return res.status(400).json(
      badRequestResponse('Năm học phải liên tiếp nhau (VD: 2024-2025)')
    );
  }

  if (req.user?.role !== 'admin') {
    return res.status(403).json(forbiddenResponse('Chỉ Admin mới có quyền tạo năm học'));
  }

  const schoolYear = await schoolYearService.createSchoolYear(year);

  return res.status(201).json(createdResponse('Tạo năm học thành công', { schoolYear }));
});

const finishSchoolYear = asyncHandler(async (req, res) => {
  const { currentYear } = req.body;

  if (!currentYear) {
    return res.status(400).json(badRequestResponse('Vui lòng cung cấp năm học hiện tại'));
  }

  if (req.user?.role !== 'admin') {
    return res.status(403).json(forbiddenResponse('Chỉ Admin mới có quyền kết thúc năm học'));
  }

  const result = await schoolYearService.finishSchoolYear(currentYear);

  return res.status(200).json(
    successResponse(
      `Đã kết thúc năm học ${result.archivedYear}. Năm học mới: ${result.newYear}`,
      result
    )
  );
});

const deleteSchoolYear = asyncHandler(async (req, res) => {
  const { year } = req.params;

  if (req.user?.role !== 'admin') {
    return res.status(403).json(forbiddenResponse('Chỉ Admin mới có quyền xóa năm học'));
  }

  await schoolYearService.deleteSchoolYear(year);

  return res.status(200).json(successResponse(`Đã xóa năm học ${year} và toàn bộ dữ liệu liên quan`));
});

module.exports = {
  getSchoolYears,
  getActiveSchoolYear,
  getSchoolYearData,
  createSchoolYear,
  finishSchoolYear,
  deleteSchoolYear
};