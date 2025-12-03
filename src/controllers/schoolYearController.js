const schoolYearService = require('../services/schoolYearService');
const asyncHandler = require('../middleware/asyncHandler');
const {
  successResponse,
  createdResponse,
  notFoundResponse,
  badRequestResponse,
  forbiddenResponse
} = require('../helper/createResponse.helper');

const YEAR_PATTERN = /^\d{4}-\d{4}$/;

const checkAdminRole = (user, res) => {
  if (user?.role !== 'admin') {
    res.status(403).json(forbiddenResponse('Chỉ Admin mới có quyền thực hiện thao tác này'));
    return false;
  }
  return true;
};

const validateYearFormat = (year) => {
  if (!YEAR_PATTERN.test(year)) {
    throw new Error('Định dạng năm học không hợp lệ (VD: 2024-2025)');
  }

  const [startYear, endYear] = year.split('-').map(Number);
  if (endYear !== startYear + 1) {
    throw new Error('Năm học phải liên tiếp nhau (VD: 2024-2025)');
  }
};

const getSchoolYears = asyncHandler(async (req, res) => {
  const years = await schoolYearService.getSchoolYears();
  return res.status(200).json(
    successResponse('Lấy danh sách năm học thành công', { schoolYears: years })
  );
});

const getActiveSchoolYear = asyncHandler(async (req, res) => {
  const activeYear = await schoolYearService.getActiveSchoolYear();

  if (!activeYear) {
    return res.status(404).json(
      notFoundResponse('Không có năm học đang hoạt động')
    );
  }

  return res.status(200).json(
    successResponse('Lấy năm học đang hoạt động thành công', activeYear)
  );
});

const getSchoolYearData = asyncHandler(async (req, res) => {
  const { year } = req.params;
  const data = await schoolYearService.getSchoolYearData(year);

  if (!data) {
    return res.status(404).json(
      notFoundResponse('Không tìm thấy năm học')
    );
  }

  return res.status(200).json(
    successResponse('Lấy dữ liệu năm học thành công', data)
  );
});

const createSchoolYear = asyncHandler(async (req, res) => {
  const { year } = req.body;

  if (!checkAdminRole(req.user, res)) return;

  if (!year) {
    return res.status(400).json(
      badRequestResponse('Vui lòng cung cấp năm học')
    );
  }

  validateYearFormat(year);

  const schoolYear = await schoolYearService.createSchoolYear(year);

  return res.status(201).json(
    createdResponse('Tạo năm học thành công', schoolYear)
  );
});

const finishSchoolYear = asyncHandler(async (req, res) => {
  if (!checkAdminRole(req.user, res)) return;

  const activeYear = await schoolYearService.getActiveSchoolYear();
  
  if (!activeYear) {
    return res.status(404).json(
      notFoundResponse('Không có năm học đang hoạt động')
    );
  }

  const result = await schoolYearService.finishSchoolYear(activeYear.year);

  return res.status(200).json(
    successResponse(
      `Đã kết thúc năm học ${result.archivedYear}. Năm học mới: ${result.newYear}`,
      result
    )
  );
});

const deleteSchoolYear = asyncHandler(async (req, res) => {
  const { year } = req.params;
  
  if (!checkAdminRole(req.user, res)) return;

  await schoolYearService.deleteSchoolYear(year);

  return res.status(200).json(
    successResponse(`Đã xóa năm học ${year} và toàn bộ dữ liệu liên quan`)
  );
});

const exportYearData = asyncHandler(async (req, res) => {
  const { year } = req.params;

  if (!checkAdminRole(req.user, res)) return;

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