// src/controllers/classController.js
const classService = require("../services/classService");
const {
  successResponse,
  createdResponse,
  notFoundResponse,
  badRequestResponse,
  conflictResponse,
  serverErrorResponse,
} = require("../helper/createResponse.helper");

const getClasses = async (req, res) => {
  try {
    const filters = {
      name: req.query.name,
      grade: req.query.grade,
    };

    const classes = await classService.getClasses(filters);

    res.json(
      successResponse("Lấy danh sách lớp học thành công", {
        classes,
        total: classes.length,
      })
    );
  } catch (error) {
    res.status(500).json(serverErrorResponse(error.message));
  }
};

const getClassById = async (req, res) => {
  try {
    const classInfo = await classService.getClassById(req.params.id);

    res.json(successResponse("Lấy thông tin lớp học thành công", classInfo));
  } catch (error) {
    if (error.message === "Class not found") {
      return res.status(404).json(notFoundResponse("Không tìm thấy lớp học"));
    }
    res.status(500).json(serverErrorResponse(error.message));
  }
};

const createClass = async (req, res) => {
  try {
    const classInfo = await classService.createClass(req.body);

    res.status(201).json(createdResponse("Tạo lớp học thành công", classInfo));
  } catch (error) {
    if (error.message === "Class name already exists") {
      return res.status(409).json(conflictResponse("Tên lớp đã tồn tại"));
    }
    res.status(500).json(serverErrorResponse(error.message));
  }
};

const updateClass = async (req, res) => {
  try {
    const classInfo = await classService.updateClass(req.params.id, req.body);

    res.json(successResponse("Cập nhật lớp học thành công", classInfo));
  } catch (error) {
    if (error.message === "Class not found") {
      return res.status(404).json(notFoundResponse("Không tìm thấy lớp học"));
    }
    if (error.message === "Class name already exists") {
      return res.status(409).json(conflictResponse("Tên lớp đã tồn tại"));
    }
    res.status(500).json(serverErrorResponse(error.message));
  }
};

const deleteClass = async (req, res) => {
  try {
    const result = await classService.deleteClass(req.params.id);

    res.json(successResponse(result.message, result.deletedClass));
  } catch (error) {
    if (error.message === "Class not found") {
      return res.status(404).json(notFoundResponse("Không tìm thấy lớp học"));
    }
    res.status(500).json(serverErrorResponse(error.message));
  }
};

const importClasses = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json(badRequestResponse("Vui lòng tải lên file Excel"));
    }

    const result = await classService.importClasses(req.file);

    res.json(
      successResponse("Import danh sách lớp học hoàn tất", {
        total: result.total,
        successCount: result.successCount,
        failedCount: result.failedCount,
        success: result.success,
        failed: result.failed,
      })
    );
  } catch (error) {
    if (error.message === "Excel file is empty") {
      return res.status(400).json(badRequestResponse("File Excel trống"));
    }
    if (error.message === "No file uploaded") {
      return res
        .status(400)
        .json(badRequestResponse("Vui lòng tải lên file Excel"));
    }
    res.status(500).json(serverErrorResponse(error.message));
  }
};

module.exports = {
  getClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  importClasses,
};