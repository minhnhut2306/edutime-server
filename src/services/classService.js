// src/services/classService.js
const Class = require("../models/classesModel");
const XLSX = require("xlsx");

const getClasses = async (filters = {}) => {
  const query = {};

  if (filters.name) {
    query.name = { $regex: filters.name, $options: "i" };
  }

  if (filters.grade) {
    query.grade = filters.grade;
  }

  const classes = await Class.find(query).sort({ createdAt: -1 });

  return classes;
};

const getClassById = async (id) => {
  const classInfo = await Class.findById(id);

  if (!classInfo) {
    throw new Error("Class not found");
  }

  return classInfo;
};

const createClass = async (data) => {
  const { name, grade, studentCount } = data;

  const existingClass = await Class.findOne({ name });
  if (existingClass) {
    throw new Error("Class name already exists");
  }

  const classInfo = await Class.create({
    name,
    grade,
    studentCount: studentCount || 0,
  });

  return classInfo;
};

const updateClass = async (id, data) => {
  const classInfo = await Class.findById(id);
  if (!classInfo) {
    throw new Error("Class not found");
  }

  if (data.name && data.name !== classInfo.name) {
    const existingClass = await Class.findOne({ name: data.name });
    if (existingClass) {
      throw new Error("Class name already exists");
    }
  }

  const updatedClass = await Class.findByIdAndUpdate(
    id,
    { ...data, updatedAt: Date.now() },
    { new: true, runValidators: true }
  );

  return updatedClass;
};

const deleteClass = async (id) => {
  const classInfo = await Class.findById(id);
  if (!classInfo) {
    throw new Error("Class not found");
  }

  await Class.findByIdAndDelete(id);

  return {
    message: "Class deleted successfully",
    deletedClass: {
      id: classInfo._id,
      name: classInfo.name,
    },
  };
};

const importClasses = async (file) => {
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

  // Hàm helper để lấy giá trị từ row không phân biệt hoa thường
  const getRowValue = (row, fieldName) => {
    const key = Object.keys(row).find(
      (k) => k.toLowerCase() === fieldName.toLowerCase()
    );
    return key ? row[key] : null;
  };

  const results = {
    success: [],
    failed: [],
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 2;

    try {
      const name = getRowValue(row, "Tên lớp");
      const grade = getRowValue(row, "Khối");
      const studentCount = getRowValue(row, "Sĩ số");

      // Kiểm tra thông tin bắt buộc
      if (!name || !grade) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: "Thiếu thông tin bắt buộc (Tên lớp, Khối)",
        });
        continue;
      }

      // Kiểm tra tên lớp đã tồn tại
      const existingClass = await Class.findOne({ name: name.toString().trim() });
      if (existingClass) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: `Tên lớp "${name}" đã tồn tại`,
        });
        continue;
      }

      // Tạo lớp mới
      const classInfo = await Class.create({
        name: name.toString().trim(),
        grade: grade.toString().trim(),
        studentCount: studentCount ? parseInt(studentCount) : 0,
      });

      results.success.push({
        row: rowNumber,
        class: classInfo,
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
  getClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  importClasses,
};