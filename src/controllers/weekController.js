const weekService = require("../services/weekService");
const {
    successResponse,
    createdResponse,
    notFoundResponse,
    badRequestResponse,
    conflictResponse,
    serverErrorResponse
} = require("../helper/createResponse.helper");

// GET /api/weeks - Lấy danh sách tuần học
const getWeeks = async (req, res) => {
    try {
        const weeks = await weekService.getWeeks();
        return res.json(successResponse("Lấy danh sách tuần học thành công", { weeks }));
    } catch (error) {
        console.error("Error in getWeeks:", error);
        return res.status(500).json(serverErrorResponse("Lỗi khi lấy danh sách tuần học"));
    }
};

// POST /api/weeks - Thêm tuần học mới (tự động đánh số tuần)
const createWeek = async (req, res) => {
    try {
        const { startDate, endDate } = req.body;

        if (!startDate || !endDate) {
            return res.status(400).json(badRequestResponse("Ngày bắt đầu và ngày kết thúc không được để trống"));
        }

        const week = await weekService.createWeek({ startDate, endDate });
        return res.status(201).json(createdResponse("Tạo tuần học thành công", { week }));
    } catch (error) {
        console.error("Error in createWeek:", error);
        
        if (error.message === "End date must be after start date") {
            return res.status(400).json(badRequestResponse("Ngày kết thúc phải sau ngày bắt đầu"));
        }
        
        if (error.message === "Week period overlaps with existing week") {
            return res.status(409).json(conflictResponse("Khoảng thời gian trùng với tuần học đã tồn tại"));
        }
        
        return res.status(500).json(serverErrorResponse("Lỗi khi tạo tuần học"));
    }
};

// PUT /api/weeks/:id - Sửa tuần học
const updateWeek = async (req, res) => {
    try {
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
    } catch (error) {
        console.error("Error in updateWeek:", error);
        
        if (error.message === "Week not found") {
            return res.status(404).json(notFoundResponse("Không tìm thấy tuần học"));
        }
        
        if (error.message === "End date must be after start date") {
            return res.status(400).json(badRequestResponse("Ngày kết thúc phải sau ngày bắt đầu"));
        }
        
        if (error.message === "Week period overlaps with existing week") {
            return res.status(409).json(conflictResponse("Khoảng thời gian trùng với tuần học đã tồn tại"));
        }
        
        return res.status(500).json(serverErrorResponse("Lỗi khi cập nhật tuần học"));
    }
};

// DELETE /api/weeks/:id - Xóa tuần học (tự động sắp xếp lại số tuần)
const deleteWeek = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json(badRequestResponse("ID tuần học không hợp lệ"));
        }

        const result = await weekService.deleteWeek(id);
        return res.json(successResponse(result.message, { week: result.deletedWeek }));
    } catch (error) {
        console.error("Error in deleteWeek:", error);
        
        if (error.message === "Week not found") {
            return res.status(404).json(notFoundResponse("Không tìm thấy tuần học"));
        }
        
        return res.status(500).json(serverErrorResponse("Lỗi khi xóa tuần học"));
    }
};

module.exports = {
    getWeeks,
    createWeek,
    updateWeek,
    deleteWeek
};