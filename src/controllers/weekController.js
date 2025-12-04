const weekService = require("../services/weekService");
const asyncHandler = require("../middleware/asyncHandler");
const SchoolYear = require("../models/schoolYearModel");
const {
  successResponse,
  createdResponse,
  badRequestResponse
} = require("../helper/createResponse.helper");

const MONGODB_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

const getSchoolYearId = async (schoolYearString) => {
  if (!schoolYearString) return null;
  
  const schoolYear = await SchoolYear.findOne({ year: schoolYearString });
  if (!schoolYear) {
    throw new Error(`Không tìm thấy năm học ${schoolYearString}`);
  }
  return schoolYear._id;
};

const getWeeks = asyncHandler(async (req, res) => {
  const schoolYearId = await getSchoolYearId(req.query.schoolYear);

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const filters = { schoolYearId };
  
  const result = await weekService.getWeeks(filters, page, limit);
  
  return res.json(
    successResponse("Lấy danh sách tuần học thành công", {
      weeks: result.weeks,
      pagination: {
        currentPage: result.currentPage,
        totalPages: result.totalPages,
        totalItems: result.totalItems,
        itemsPerPage: result.itemsPerPage,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage
      }
    })
  );
});

const createWeek = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json(
      badRequestResponse("Ngày bắt đầu và ngày kết thúc không được để trống")
    );
  }

  const week = await weekService.createWeek({ startDate, endDate });
  
  return res.status(201).json(
    createdResponse("Tạo tuần học thành công", { week })
  );
});

const updateWeek = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { startDate, endDate } = req.body;

  if (!MONGODB_ID_PATTERN.test(id)) {
    return res.status(400).json(
      badRequestResponse("Không tìm thấy tuần học cần cập nhật. Vui lòng thử lại")
    );
  }

  if (!startDate && !endDate) {
    return res.status(400).json(
      badRequestResponse("Cần cung cấp ít nhất một thông tin để cập nhật")
    );
  }

  const week = await weekService.updateWeek(id, { startDate, endDate });
  
  return res.json(
    successResponse("Cập nhật tuần học thành công", { week })
  );
});

const deleteWeek = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!MONGODB_ID_PATTERN.test(id)) {
    return res.status(400).json(
      badRequestResponse("Không tìm thấy tuần học cần xóa. Vui lòng thử lại")
    );
  }

  const result = await weekService.deleteWeek(id);
  
  return res.json(
    successResponse(result.message, { week: result.deletedWeek })
  );
});

module.exports = {
  getWeeks,
  createWeek,
  updateWeek,
  deleteWeek
};