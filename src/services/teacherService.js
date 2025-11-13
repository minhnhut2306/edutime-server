const Teacher = require("../models/teacherModel");
const User = require("../models/userModel");
const Subject = require("../models/subjectModel");
const Class = require("../models/classesModel");
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

  if (!name || !userId) {
    throw new Error("Name and userId are required");
  }

  const [existingPhone, existingUser, user] = await Promise.all([
    phone ? Teacher.findOne({ phone }) : null,
    Teacher.findOne({ userId }),
    User.findById(userId),
  ]);

  if (existingPhone) {
    throw new Error("Phone number already exists");
  }

  if (existingUser) {
    throw new Error("User already assigned to another teacher");
  }

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

  const checks = [];

  if (data.phone && data.phone !== teacher.phone) {
    checks.push(
      Teacher.findOne({ phone: data.phone }).then((existing) => {
        if (existing) throw new Error("Phone number already exists");
      })
    );
  }

  if (data.userId && data.userId.toString() !== teacher.userId.toString()) {
    checks.push(
      Teacher.findOne({ userId: data.userId }).then((existing) => {
        if (existing)
          throw new Error("User already assigned to another teacher");
      })
    );
  }

  if (checks.length > 0) {
    await Promise.all(checks);
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
  const teacher = await Teacher.findByIdAndDelete(id);
  
  if (!teacher) {
    throw new Error("Teacher not found");
  }

  return {
    message: "Teacher deleted successfully",
    deletedTeacher: {
      id: teacher._id,
      name: teacher.name,
    },
  };
};

const generateTeacherCode = async () => {
  const lastTeacher = await Teacher.findOne()
    .sort({ teacherCode: -1 })
    .select("teacherCode");

  if (!lastTeacher || !lastTeacher.teacherCode) {
    return "GV001";
  }

  const lastNumber = parseInt(lastTeacher.teacherCode.substring(2));
  const nextNumber = lastNumber + 1;

  return `GV${nextNumber.toString().padStart(3, "0")}`;
};

const getRowValue = (row, fieldName) => {
  const key = Object.keys(row).find(
    (k) => k.toLowerCase() === fieldName.toLowerCase()
  );
  return key ? row[key] : null;
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

  const results = {
    success: [],
    failed: [],
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 2;

    try {
      let teacherCode = getRowValue(row, "Mã GV");
      teacherCode = teacherCode ? teacherCode.toString().trim() : null;

      const name = getRowValue(row, "Họ và tên");
      const email = getRowValue(row, "Email");
      const phone = getRowValue(row, "Số điện thoại");
      const subjectName = getRowValue(row, "Môn dạy");
      const className = getRowValue(row, "Lớp chủ nhiệm");

      if (!name || !email || !subjectName || !className) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason:
            "Thiếu thông tin bắt buộc (Họ và tên, Email, Môn dạy, Lớp chủ nhiệm)",
        });
        continue;
      }

      if (!teacherCode) {
        teacherCode = await generateTeacherCode();
      } else {
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

      const [subject, classInfo] = await Promise.all([
        Subject.findOne({ name: subjectName.trim() }),
        Class.findOne({ name: className.trim() }),
      ]);

      if (!subject) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: `Môn học "${subjectName}" không tồn tại`,
        });
        continue;
      }

      if (!classInfo) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: `Lớp "${className}" không tồn tại`,
        });
        continue;
      }

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