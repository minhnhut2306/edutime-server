const teacherService = require("../services/teacherService");
const asyncHandler = require("../middleware/asyncHandler");
const {
  successResponse,
  createdResponse,
  badRequestResponse
} = require("../helper/createResponse.helper");

const getTeachers = asyncHandler(async (req, res) => {
  const filters = {
    name: req.query.name,
    phone: req.query.phone,
    subjectId: req.query.subjectId,
    mainClassId: req.query.mainClassId,
    schoolYear: req.query.schoolYear
  };

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const result = await teacherService.getTeachers(filters, page, limit);

  return res.json(
    successResponse("Lấy danh sách giáo viên thành công", result)
  );
});

const getTeacherById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const teacher = await teacherService.getTeacherById(id);

  return res.json(
    successResponse("Lấy thông tin giáo viên thành công", { teacher })
  );
});

const createTeacher = asyncHandler(async (req, res) => {
  const { name, subjectIds } = req.body;

  if (!name || name.trim() === '') {
    return res.status(400).json(
      badRequestResponse("Họ tên giáo viên không được để trống")
    );
  }

  if (!subjectIds || subjectIds.length === 0) {
    return res.status(400).json(
      badRequestResponse("Vui lòng chọn ít nhất một môn học")
    );
  }

  const teacher = await teacherService.createTeacher(req.body);

  return res.status(201).json(
    createdResponse("Thêm giáo viên thành công", { teacher })
  );
});

const updateTeacher = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (req.body.name !== undefined && req.body.name.trim() === '') {
    return res.status(400).json(
      badRequestResponse("Họ tên giáo viên không được để trống")
    );
  }

  if (req.body.subjectIds !== undefined && req.body.subjectIds.length === 0) {
    return res.status(400).json(
      badRequestResponse("Vui lòng chọn ít nhất một môn học")
    );
  }

  const teacher = await teacherService.updateTeacher(id, req.body);

  return res.json(
    successResponse("Cập nhật giáo viên thành công", { teacher })
  );
});

const updateTeacherUserId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json(
      badRequestResponse("Vui lòng chọn tài khoản để gán")
    );
  }

  const teacher = await teacherService.updateTeacherUserId(id, userId);

  return res.json(
    successResponse("Gán tài khoản cho giáo viên thành công", { teacher })
  );
});

const deleteTeacher = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await teacherService.deleteTeacher(id);

  return res.json(
    successResponse("Xóa giáo viên thành công", result)
  );
});

const importTeachers = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json(
      badRequestResponse("Vui lòng tải lên file Excel")
    );
  }

  const results = await teacherService.importTeachers(req.file);
  
  return res.json(
    successResponse("Import giáo viên hoàn tất", results)
  );
});

module.exports = {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  updateTeacherUserId,
  deleteTeacher,
  importTeachers
};