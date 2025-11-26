const subjectService = require("../services/subjectService");
const asyncHandler = require("../middleware/asyncHandler");
const {
    successResponse,
    createdResponse,
    notFoundResponse,
    badRequestResponse,
    conflictResponse
} = require("../helper/createResponse.helper");

const getSubjects = asyncHandler(async (req, res) => {
    const filters = {
        name: req.query.name,
        schoolYear: req.query.schoolYear,
    };

    const subjects = await subjectService.getSubjects(filters);
    return res.json(successResponse("Lấy danh sách môn học thành công", { subjects }));
});

const createSubject = asyncHandler(async (req, res) => {
    const { name } = req.body;

    if (!name || name.trim() === "") {
        return res.status(400).json(badRequestResponse("Tên môn học không được để trống"));
    }

    const subject = await subjectService.createSubject({ name: name.trim() });
    return res.status(201).json(createdResponse("Tạo môn học thành công", { subject }));
});

const deleteSubject = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json(badRequestResponse("ID môn học không hợp lệ"));
    }

    const result = await subjectService.deleteSubject(id);
    return res.json(successResponse(result.message, { subject: result.deletedSubject }));
});

module.exports = {
    getSubjects,
    createSubject,
    deleteSubject
};