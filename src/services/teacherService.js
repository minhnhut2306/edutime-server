// src/services/teacherService.js
const Teacher = require("../models/teacherModel");
const User = require("../models/userModel");
const XLSX = require("xlsx");

const getTeachers = async (filters = {}) => {
  const query = {};

  if (filters.name) {
    query.name = { $regex: filters.name, $options: "i" };
  }

  if (filters.phone) {
    query.phone = { $regex: filters.phone, $options: "i" };
  }

  if (filters.subjectId) {
    query.subjectIds = filters.subjectId;
  }

  if (filters.mainClassId) {
    query.mainClassId = filters.mainClassId;
  }

  const teachers = await Teacher.find(query)
    .populate("userId", "email")
    .populate("subjectIds", "name")
    .populate("mainClassId", "name grade")
    .sort({ createdAt: -1 });

  return teachers;
};

const getTeacherById = async (id) => {
  const teacher = await Teacher.findById(id)
    .populate("userId", "email")
    .populate("subjectIds", "name")
    .populate("mainClassId", "name grade");

  if (!teacher) {
    throw new Error("Teacher not found");
  }

  return teacher;
};

const createTeacher = async (data) => {
  const { name, phone, userId, subjectIds, mainClassId } = data;

  const existingPhone = await Teacher.findOne({ phone });
  if (existingPhone) {
    throw new Error("Phone number already exists");
  }

  const existingUser = await Teacher.findOne({ userId });
  if (existingUser) {
    throw new Error("User already assigned to another teacher");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const teacher = await Teacher.create({
    name,
    phone,
    userId,
    subjectIds,
    mainClassId,
  });

  return teacher.populate([
    { path: "userId", select: "email" },
    { path: "subjectIds", select: "name" },
    { path: "mainClassId", select: "name grade" },
  ]);
};

const updateTeacher = async (id, data) => {
  const teacher = await Teacher.findById(id);
  if (!teacher) {
    throw new Error("Teacher not found");
  }

  if (data.phone && data.phone !== teacher.phone) {
    const existingPhone = await Teacher.findOne({ phone: data.phone });
    if (existingPhone) {
      throw new Error("Phone number already exists");
    }
  }

  if (data.userId && data.userId.toString() !== teacher.userId.toString()) {
    const existingUser = await Teacher.findOne({ userId: data.userId });
    if (existingUser) {
      throw new Error("User already assigned to another teacher");
    }
  }

  const updatedTeacher = await Teacher.findByIdAndUpdate(
    id,
    { ...data, updatedAt: Date.now() },
    { new: true, runValidators: true }
  ).populate([
    { path: "userId", select: "email" },
    { path: "subjectIds", select: "name" },
    { path: "mainClassId", select: "name grade" },
  ]);

  return updatedTeacher;
};

const deleteTeacher = async (id) => {
  const teacher = await Teacher.findById(id);
  if (!teacher) {
    throw new Error("Teacher not found");
  }

  await Teacher.findByIdAndDelete(id);

  return {
    message: "Teacher deleted successfully",
    deletedTeacher: {
      id: teacher._id,
      name: teacher.name,
    },
  };
};
const importTeachers = async (file) => {
  if (!file) {
    throw new Error("No file uploaded");
  }

  const workbook = XLSX.read(file.buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  if (data.length === 0) {
    throw new Error("Excel file is empty");
  }

  // Hàm tạo mã giáo viên tự động
  const generateTeacherCode = async () => {
    // Tìm mã giáo viên lớn nhất hiện có
    const lastTeacher = await Teacher.findOne()
      .sort({ teacherCode: -1 })
      .select("teacherCode");

    if (!lastTeacher || !lastTeacher.teacherCode) {
      return "GV001";
    }

    // Lấy số từ mã (VD: GV001 -> 001)
    const lastNumber = parseInt(lastTeacher.teacherCode.substring(2));
    const nextNumber = lastNumber + 1;

    // Format lại thành GV + 3 chữ số (VD: GV002)
    return `GV${nextNumber.toString().padStart(3, "0")}`;
  };

  const results = {
    success: [],
    failed: [],
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 2;

    try {
      // Hàm helper để lấy giá trị từ row không phân biệt hoa thường
      const getRowValue = (row, fieldName) => {
        const key = Object.keys(row).find(
          (k) => k.toLowerCase() === fieldName.toLowerCase()
        );
        return key ? row[key] : null;
      };

      // Lấy dữ liệu từ Excel (không phân biệt hoa thường)
      let teacherCode = getRowValue(row, "Mã GV");
      teacherCode = teacherCode ? teacherCode.toString().trim() : null;

      const name = getRowValue(row, "Họ và tên");
      const email = getRowValue(row, "Email");
      const phone = getRowValue(row, "Số điện thoại");
      const subjectName = getRowValue(row, "Môn dạy");
      const className = getRowValue(row, "Lớp chủ nhiệm");

      // Kiểm tra thông tin bắt buộc (phone không bắt buộc)
      if (!name || !email || !subjectName || !className) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason:
            "Thiếu thông tin bắt buộc (Họ và tên, Email, Môn dạy, Lớp chủ nhiệm)",
        });
        continue;
      }

      // Nếu không có mã GV trong Excel, tạo tự động
      if (!teacherCode) {
        teacherCode = await generateTeacherCode();
      } else {
        // Kiểm tra mã GV đã tồn tại chưa
        const existingCode = await Teacher.findOne({ teacherCode });
        if (existingCode) {
          results.failed.push({
            row: rowNumber,
            data: row,
            reason: `Mã giáo viên ${teacherCode} đã tồn tại`,
          });
          continue;
        }
      }

      // Kiểm tra số điện thoại (chỉ khi có phone)
      if (phone && phone.trim()) {
        const existingTeacher = await Teacher.findOne({ phone: phone.trim() });
        if (existingTeacher) {
          results.failed.push({
            row: rowNumber,
            data: row,
            reason: `Số điện thoại ${phone} đã tồn tại`,
          });
          continue;
        }
      }

      // Xử lý User
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          email: email.trim(),
          password: "Teacher@123",
        });
      } else {
        const existingTeacherWithUser = await Teacher.findOne({
          userId: user._id,
        });
        if (existingTeacherWithUser) {
          results.failed.push({
            row: rowNumber,
            data: row,
            reason: `Email ${email} đã được gán cho giáo viên khác`,
          });
          continue;
        }
      }

      // Kiểm tra Subject
      const subject = await Subject.findOne({ name: subjectName.trim() });
      if (!subject) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: `Môn học "${subjectName}" không tồn tại`,
        });
        continue;
      }

      // Kiểm tra Class
      const classInfo = await Class.findOne({ name: className.trim() });
      if (!classInfo) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: `Lớp "${className}" không tồn tại`,
        });
        continue;
      }

      // Tạo Teacher với teacherCode (phone có thể null)
      const teacher = await Teacher.create({
        teacherCode,
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        userId: user._id,
        subjectIds: [subject._id],
        mainClassId: classInfo._id,
      });

      const populatedTeacher = await Teacher.findById(teacher._id)
        .populate("userId", "email")
        .populate("subjectIds", "name")
        .populate("mainClassId", "name grade");

      results.success.push({
        row: rowNumber,
        teacherCode,
        teacher: populatedTeacher,
      });
    } catch (error) {
      results.failed.push({
        row: rowNumber,
        data: row,
        reason: error.message,
      });
    }
  }

  return {
    total: data.length,
    successCount: results.success.length,
    failedCount: results.failed.length,
    success: results.success,
    failed: results.failed,
  };
};

module.exports = {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  importTeachers,
};
