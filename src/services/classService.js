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
  if (!id) {
    throw new Error("Class ID is required");
  }

  const classInfo = await Class.findById(id);

  if (!classInfo) {
    throw new Error("Class not found");
  }

  return classInfo;
};

const createClass = async (data) => {
  const { name, grade, studentCount } = data;

  if (!name || !grade) {
    throw new Error("Class name and grade are required");
  }

  const trimmedName = name.toString().trim();

  if (!trimmedName) {
    throw new Error("Class name cannot be empty");
  }

  const existingClass = await Class.findOne({ name: trimmedName });
  if (existingClass) {
    throw new Error("Class name already exists");
  }

  const classInfo = await Class.create({
    name: trimmedName,
    grade: grade.toString().trim(),
    studentCount: studentCount ? parseInt(studentCount) : 0,
  });

  return classInfo;
};

const updateClass = async (id, data) => {
  if (!id) {
    throw new Error("Class ID is required");
  }

  const classInfo = await Class.findById(id);
  if (!classInfo) {
    throw new Error("Class not found");
  }

  if (data.name) {
    const trimmedName = data.name.toString().trim();
    
    if (!trimmedName) {
      throw new Error("Class name cannot be empty");
    }

    if (trimmedName !== classInfo.name) {
      const existingClass = await Class.findOne({ name: trimmedName });
      if (existingClass) {
        throw new Error("Class name already exists");
      }
      data.name = trimmedName;
    }
  }

  if (data.grade) {
    data.grade = data.grade.toString().trim();
  }

  const updatedClass = await Class.findByIdAndUpdate(
    id,
    { ...data, updatedAt: Date.now() },
    { new: true, runValidators: true }
  );

  return updatedClass;
};

const deleteClass = async (id) => {
  if (!id) {
    throw new Error("Class ID is required");
  }

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

const getRowValue = (row, fieldName) => {
  const key = Object.keys(row).find(
    (k) => k.toLowerCase() === fieldName.toLowerCase()
  );
  return key ? row[key] : null;
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

      if (!name || !grade) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: "Thiếu thông tin bắt buộc (Tên lớp, Khối)",
        });
        continue;
      }

      const trimmedName = name.toString().trim();

      if (!trimmedName) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: "Tên lớp không được để trống",
        });
        continue;
      }

      const existingClass = await Class.findOne({ name: trimmedName });
      if (existingClass) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: `Tên lớp "${trimmedName}" đã tồn tại`,
        });
        continue;
      }

      const classInfo = await Class.create({
        name: trimmedName,
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