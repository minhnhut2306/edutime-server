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
  return res.status(200).json(successResponse('Lấy danh sách năm học thành công', { schoolYears: years }));
});

const getActiveSchoolYear = asyncHandler(async (req, res) => {
  const activeYear = await schoolYearService.getActiveSchoolYear();
  if (!activeYear) {
    return res.status(404).json(notFoundResponse('Hiện chưa có năm học đang hoạt động. Vui lòng tạo hoặc chọn năm học.'));
  }
  return res.status(200).json(successResponse('Lấy năm học đang hoạt động thành công', activeYear));
});

const getSchoolYearData = asyncHandler(async (req, res) => {
  const { year } = req.params;
  if (!year) {
    return res.status(400).json(badRequestResponse('Vui lòng cung cấp năm học để xem chi tiết'));
  }
  const data = await schoolYearService.getSchoolYearData(year);
  if (!data) {
    return res.status(404).json(notFoundResponse('Không tìm thấy năm học. Vui lòng kiểm tra lại.'));
  }
  return res.status(200).json(successResponse('Lấy dữ liệu năm học thành công', data));
});

const createSchoolYear = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json(forbiddenResponse('Chỉ quản trị viên mới có quyền tạo năm học'));
  }
  const { year } = req.body;
  if (!year) {
    return res.status(400).json(badRequestResponse('Vui lòng nhập năm học (ví dụ: 2024-2025)'));
  }
  const yearPattern = /^\d{4}-\d{4}$/;
  if (!yearPattern.test(year)) {
    return res.status(400).json(badRequestResponse('Định dạng năm học không hợp lệ. Ví dụ hợp lệ: 2024-2025'));
  }
  const [startYear, endYear] = year.split('-').map(Number);
  if (endYear !== startYear + 1) {
    return res.status(400).json(badRequestResponse('Năm học phải là hai năm liên tiếp. Ví dụ: 2024-2025'));
  }
  const schoolYear = await schoolYearService.createSchoolYear(year);
  return res.status(201).json(createdResponse('Tạo năm học thành công', schoolYear));
});

const finishSchoolYear = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json(forbiddenResponse('Chỉ quản trị viên mới có quyền kết thúc năm học'));
  }
  const activeYear = await schoolYearService.getActiveSchoolYear();
  if (!activeYear) {
    return res.status(404).json(notFoundResponse('Hiện chưa có năm học đang hoạt động'));
  }
  const currentYear = activeYear.year;
  const result = await schoolYearService.finishSchoolYear(currentYear);
  return res.status(200).json(successResponse(`Đã kết thúc năm học ${result.archivedYear}. Năm học mới: ${result.newYear}`, result));
});

const deleteSchoolYear = asyncHandler(async (req, res) => {
  const { year } = req.params;
  if (req.user?.role !== 'admin') {
    return res.status(403).json(forbiddenResponse('Chỉ quản trị viên mới có quyền xóa năm học'));
  }
  await schoolYearService.deleteSchoolYear(year);
  return res.status(200).json(successResponse(`Đã xóa năm học ${year} và toàn bộ dữ liệu liên quan`));
});

const exportYearData = asyncHandler(async (req, res) => {
  const { year } = req.params;
  if (req.user?.role !== 'admin') {
    return res.status(403).json(forbiddenResponse('Chỉ quản trị viên mới có quyền xuất dữ liệu'));
  }
  if (!year) {
    return res.status(400).json(badRequestResponse('Vui lòng chọn năm học để xuất dữ liệu'));
  }
  const workbook = await schoolYearService.exportYearData(year);
  const fileName = `DuLieu_NamHoc_${year}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = {
  getSchoolYears,
  getActiveSchoolYear,
  getSchoolYearData,
  createSchoolYear,
  finishSchoolYear,
  deleteSchoolYear,
  exportYearData
};