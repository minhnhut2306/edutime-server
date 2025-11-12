// src/controllers/teacherController.js
const teacherService = require("../services/teacherService");
const {
  successResponse,
  createdResponse,
  badRequestResponse,
  notFoundResponse,
  serverErrorResponse
} = require("../helper/createResponse.helper");

const getTeachers = async (req, res) => {
  try {
    const filters = {
      name: req.query.name,
      phone: req.query.phone,
      subjectId: req.query.subjectId,
      mainClassId: req.query.mainClassId
    };

    const teachers = await teacherService.getTeachers(filters);

    return res.json(
      successResponse("Lấy danh sách giáo viên thành công", { teachers })
    );
  } catch (error) {
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi lấy danh sách giáo viên", { error: error.message }));
  }
};

const getTeacherById = async (req, res) => {
  try {
    const { id } = req.params;
    const teacher = await teacherService.getTeacherById(id);

    return res.json(
      successResponse("Lấy thông tin giáo viên thành công", { teacher })
    );
  } catch (error) {
    if (error.message === "Teacher not found") {
      return res
        .status(404)
        .json(notFoundResponse("Giáo viên không tồn tại"));
    }
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi lấy thông tin giáo viên", { error: error.message }));
  }
};

const createTeacher = async (req, res) => {
  try {
    const { name, phone, userId, subjectIds, mainClassId } = req.body;

    if (!name || !phone || !userId || !subjectIds || !mainClassId) {
      return res
        .status(400)
        .json(badRequestResponse("Thiếu thông tin bắt buộc"));
    }

    const teacher = await teacherService.createTeacher(req.body);

    return res
      .status(201)
      .json(createdResponse("Thêm giáo viên thành công", { teacher }));
  } catch (error) {
    if (error.message === "Phone number already exists") {
      return res
        .status(400)
        .json(badRequestResponse("Số điện thoại đã tồn tại"));
    }
    if (error.message === "User already assigned to another teacher") {
      return res
        .status(400)
        .json(badRequestResponse("User đã được gán cho giáo viên khác"));
    }
    if (error.message === "User not found") {
      return res
        .status(404)
        .json(notFoundResponse("User không tồn tại"));
    }
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi thêm giáo viên", { error: error.message }));
  }
};

const updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const teacher = await teacherService.updateTeacher(id, req.body);

    return res.json(
      successResponse("Cập nhật giáo viên thành công", { teacher })
    );
  } catch (error) {
    if (error.message === "Teacher not found") {
      return res
        .status(404)
        .json(notFoundResponse("Giáo viên không tồn tại"));
    }
    if (error.message === "Phone number already exists") {
      return res
        .status(400)
        .json(badRequestResponse("Số điện thoại đã tồn tại"));
    }
    if (error.message === "User already assigned to another teacher") {
      return res
        .status(400)
        .json(badRequestResponse("User đã được gán cho giáo viên khác"));
    }
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi cập nhật giáo viên", { error: error.message }));
  }
};

const deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await teacherService.deleteTeacher(id);

    return res.json(
      successResponse("Xóa giáo viên thành công", result)
    );
  } catch (error) {
    if (error.message === "Teacher not found") {
      return res
        .status(404)
        .json(notFoundResponse("Giáo viên không tồn tại"));
    }
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi xóa giáo viên", { error: error.message }));
  }
};

const importTeachers = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json(badRequestResponse("Vui lòng tải lên file Excel"));
    }

    const results = await teacherService.importTeachers(req.file);

    return res.json(
      successResponse("Import giáo viên hoàn tất", results)
    );
  } catch (error) {
    return res
      .status(500)
      .json(serverErrorResponse("Lỗi import giáo viên", { error: error.message }));
  }
};

module.exports = {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  importTeachers
};