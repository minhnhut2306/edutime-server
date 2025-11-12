const subjectService = require("../services/subjectService");
const {
    successResponse,
    createdResponse,
    notFoundResponse,
    badRequestResponse,
    conflictResponse,
    serverErrorResponse
} = require("../helper/createResponse.helper");

// GET /api/subjects - Lấy danh sách môn học
const getSubjects = async (req, res) => {
    try {
        const filters = {
            name: req.query.name,
        };

        const subjects = await subjectService.getSubjects(filters);
        return res.json(successResponse("Lấy danh sách môn học thành công", { subjects }));
    } catch (error) {
        console.error("Error in getSubjects:", error);
        return res.status(500).json(serverErrorResponse("Lỗi khi lấy danh sách môn học"));
    }
};

// POST /api/subjects - Thêm môn học mới
const createSubject = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || name.trim() === "") {
            return res.status(400).json(badRequestResponse("Tên môn học không được để trống"));
        }

        const subject = await subjectService.createSubject({ name: name.trim() });
        return res.status(201).json(createdResponse("Tạo môn học thành công", { subject }));
    } catch (error) {
        console.error("Error in createSubject:", error);
        
        if (error.message === "Subject name already exists") {
            return res.status(409).json(conflictResponse("Tên môn học đã tồn tại"));
        }
        
        return res.status(500).json(serverErrorResponse("Lỗi khi tạo môn học"));
    }
};

// DELETE /api/subjects/:id - Xóa môn học
const deleteSubject = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json(badRequestResponse("ID môn học không hợp lệ"));
        }

        const result = await subjectService.deleteSubject(id);
        return res.json(successResponse(result.message, { subject: result.deletedSubject }));
    } catch (error) {
        console.error("Error in deleteSubject:", error);
        
        if (error.message === "Subject not found") {
            return res.status(404).json(notFoundResponse("Không tìm thấy môn học"));
        }
        
        return res.status(500).json(serverErrorResponse("Lỗi khi xóa môn học"));
    }
};

module.exports = {
    getSubjects,
    createSubject,
    deleteSubject
};