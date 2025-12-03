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

  const teachers = await teacherService.getTeachers(filters);

  return res.json(
    successResponse("Lấy danh sách giáo viên thành công", { teachers })
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
  const { name, subjectIds, mainClassId } = req.body;

  if (!name || !subjectIds || !mainClassId) {
    return res.status(400).json(
      badRequestResponse("Thiếu thông tin bắt buộc: tên, môn học và lớp chủ nhiệm")
    );
  }

  const teacher = await teacherService.createTeacher(req.body);

  return res.status(201).json(
    createdResponse("Thêm giáo viên thành công", { teacher })
  );
});

const updateTeacher = asyncHandler(async (req, res) => {
  const { id } = req.params;
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
      badRequestResponse("userId là bắt buộc")
    );
  }

  const teacher = await teacherService.updateTeacherUserId(id, userId);

  return res.json(
    successResponse("Gán user cho giáo viên thành công", { teacher })
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