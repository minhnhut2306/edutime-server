const weekService = require("../services/weekService");
const asyncHandler = require("../middleware/asyncHandler");
const {
    successResponse,
    createdResponse,
    notFoundResponse,
    badRequestResponse,
    conflictResponse
} = require("../helper/createResponse.helper");

const getWeeks = asyncHandler(async (req, res) => {
    const filters = {
      schoolYear: req.query.schoolYear, 
    };
    
    const weeks = await weekService.getWeeks(filters);
    return res.json(successResponse("Lấy danh sách tuần học thành công", { weeks }));
  });

const createWeek = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
        return res.status(400).json(badRequestResponse("Ngày bắt đầu và ngày kết thúc không được để trống"));
    }

    const week = await weekService.createWeek({ startDate, endDate });
    return res.status(201).json(createdResponse("Tạo tuần học thành công", { week }));
});

const updateWeek = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { startDate, endDate } = req.body;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json(badRequestResponse("ID tuần học không hợp lệ"));
    }

    if (!startDate && !endDate) {
        return res.status(400).json(badRequestResponse("Cần cung cấp ít nhất một thông tin để cập nhật"));
    }

    const week = await weekService.updateWeek(id, { startDate, endDate });
    return res.json(successResponse("Cập nhật tuần học thành công", { week }));
});

const deleteWeek = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json(badRequestResponse("ID tuần học không hợp lệ"));
    }

    const result = await weekService.deleteWeek(id);
    return res.json(successResponse(result.message, { week: result.deletedWeek }));
});

module.exports = {
    getWeeks,
    createWeek,
    updateWeek,
    deleteWeek
};