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

  if (!name || !subjectIds || !mainClassId) {
    throw new Error("Name, subjectIds và mainClassId là bắt buộc");
  }

  const checks = [];

  if (phone) {
    checks.push(
      Teacher.findOne({ phone }).then((existing) => {
        if (existing) throw new Error("Phone number already exists");
      })
    );
  }

  if (userId) {
    checks.push(
      Teacher.findOne({ userId }).then((existing) => {
        if (existing)
          throw new Error("User already assigned to another teacher");
      }),
      User.findById(userId).then((user) => {
        if (!user) throw new Error("User not found");
      })
    );
  }

  if (checks.length > 0) {
    await Promise.all(checks);
  }

  const teacher = await Teacher.create({
    name,
    phone: phone || null,
    userId: userId || null,
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

  if (data.phone && (!teacher.phone || data.phone !== teacher.phone)) {
    checks.push(
      Teacher.findOne({ phone: data.phone }).then((existing) => {
        if (existing && existing._id.toString() !== id) {
          throw new Error("Phone number already exists");
        }
      })
    );
  }

  if (data.userId) {
    checks.push(
      Teacher.findOne({ userId: data.userId }).then((existing) => {
        if (existing && existing._id.toString() !== id) {
          throw new Error("User already assigned to another teacher");
        }
      }),
      User.findById(data.userId).then((user) => {
        if (!user) throw new Error("User not found");
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

const updateTeacherUserId = async (teacherId, userId) => {
  const teacher = await Teacher.findById(teacherId);
  if (!teacher) {
    throw new Error("Teacher not found");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const existingTeacher = await Teacher.findOne({ userId });
  if (existingTeacher && existingTeacher._id.toString() !== teacherId) {
    throw new Error("User already assigned to another teacher");
  }

  teacher.userId = userId;
  teacher.updatedAt = Date.now();
  await teacher.save();

  return teacher.populate([
    { path: "userId", select: "email" },
    { path: "subjectIds", select: "name" },
    { path: "mainClassId", select: "name grade" },
  ]);
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

const removeVietnameseTones = (str) => {
  if (!str) return "";
  str = str.toLowerCase().trim();
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  return str;
};

const findSubjectFlexible = async (subjectName) => {
  if (!subjectName) return null;

  const normalizedName = removeVietnameseTones(subjectName);

  const allSubjects = await Subject.find({});

  const subject = allSubjects.find((s) => {
    const dbName = removeVietnameseTones(s.name);
    return dbName === normalizedName;
  });

  return subject;
};

const findClassFlexible = async (className) => {
  if (!className) return null;

  const normalizedName = removeVietnameseTones(className);

  const allClasses = await Class.find({});

  const classInfo = allClasses.find((c) => {
    const dbName = removeVietnameseTones(c.name);
    return dbName === normalizedName;
  });

  return classInfo;
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
      const teacherCode = await generateTeacherCode();

      const name = getRowValue(row, "Họ và tên");
      let phone = getRowValue(row, "Số điện thoại");
      const subjectNames = getRowValue(row, "Môn dạy");
      const className = getRowValue(row, "Lớp chủ nhiệm");

      if (phone) {
        phone = String(phone).trim();
        if (phone.length === 9 && !phone.startsWith("0")) {
          phone = "0" + phone;
        }
      }

      if (!name || !subjectNames || !className) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason:
            "Thiếu thông tin bắt buộc (Họ và tên, Môn dạy, Lớp chủ nhiệm)",
        });
        continue;
      }

      if (phone && phone !== "") {
        const existingTeacher = await Teacher.findOne({ phone: phone });
        if (existingTeacher) {
          results.failed.push({
            row: rowNumber,
            data: row,
            reason: `Số điện thoại ${phone} đã tồn tại`,
          });
          continue;
        }
      }

      const subjectNameList = subjectNames.split(",").map((s) => s.trim());
      const subjectIds = [];
      let missingSubject = null;

      for (const subjectName of subjectNameList) {
        const subject = await findSubjectFlexible(subjectName);
        if (!subject) {
          missingSubject = subjectName;
          break;
        }
        subjectIds.push(subject._id);
      }

      if (missingSubject) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: `Môn học "${missingSubject}" không tồn tại`,
        });
        continue;
      }

      if (subjectIds.length === 0) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: "Không tìm thấy môn học nào hợp lệ",
        });
        continue;
      }

      const classInfo = await findClassFlexible(className);
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
        phone: phone || null,
        subjectIds: subjectIds,
        mainClassId: classInfo._id,
      });

      const populatedTeacher = await Teacher.findById(teacher._id)
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
  updateTeacherUserId,
  deleteTeacher,
  importTeachers,
};