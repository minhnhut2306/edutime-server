const Class = require("../models/classesModel");
const SchoolYear = require("../models/schoolYearModel");

const normalizeClassName = (name) => {
  if (!name) return null;
  const normalized = name.toString().trim().replace(/\s+/g, "").toUpperCase();
  const match = normalized.match(/^(\d{1,2})([A-Z]\d{0,2})$/);
  if (match) {
    return match[1] + match[2];
  }
  return normalized || null;
};

const getActiveSchoolYearId = async () => {
  const activeYear = await SchoolYear.findOne({ status: "active" });
  if (!activeYear) {
    throw new Error("Không có năm học đang hoạt động. Vui lòng tạo năm học mới!");
  }
  return activeYear._id;
};

const extractGradeFromClassName = (className) => {
  if (!className) return null;
  const match = className.toString().trim().match(/^(\d{1,2})/);
  return match ? match[1] : null;
};

const getClasses = async (filters = {}) => {
  const schoolYearId = filters.schoolYearId || await getActiveSchoolYearId();
  const query = { schoolYearId };
  if (filters.name) {
    const normalizedSearchName = normalizeClassName(filters.name);
    if (normalizedSearchName) {
      query.name = { $regex: `^${normalizedSearchName}`, $options: "i" };
    }
  }
  if (filters.grade) {
    query.grade = filters.grade.toString().trim();
  }
  const classes = await Class.find(query).sort({ createdAt: -1 });
  return classes;
};

const getClassById = async (id) => {
  if (!id) {
    throw new Error("ID lớp học là bắt buộc");
  }
  const classInfo = await Class.findById(id);
  if (!classInfo) {
    throw new Error("Không tìm thấy lớp học");
  }
  return classInfo;
};

const createClass = async (data) => {
  const name = data?.name;
  let grade = data?.grade;
  const studentCountRaw = data?.studentCount;
  const schoolYearId = data?.schoolYearId || await getActiveSchoolYearId();

  if (!name) {
    throw new Error("Tên lớp là bắt buộc");
  }

  const normalizedName = normalizeClassName(name);
  if (!normalizedName) {
    throw new Error("Tên lớp không hợp lệ sau khi chuẩn hóa");
  }

  if (!grade) {
    const extractedGrade = extractGradeFromClassName(normalizedName);
    if (extractedGrade) {
      grade = extractedGrade;
    } else {
      throw new Error("Không thể xác định khối từ tên lớp. Vui lòng nhập khối hoặc đặt tên lớp theo định dạng: 10A1, 11B2,...");
    }
  }

  const existingClass = await Class.findOne({
    name: normalizedName,
    schoolYearId,
    status: "active"
  });

  if (existingClass) {
    throw new Error(`Lớp "${normalizedName}" đã tồn tại trong năm học này`);
  }

  const studentCount = Number.isFinite(Number(studentCountRaw)) ? parseInt(studentCountRaw, 10) : 0;

  const classInfo = await Class.create({
    name: normalizedName,
    grade: grade.toString().trim(),
    studentCount,
    schoolYearId,
    status: "active"
  });

  return classInfo;
};

const updateClass = async (id, data) => {
  if (!id) {
    throw new Error("ID lớp học là bắt buộc");
  }

  const classInfo = await Class.findById(id);
  if (!classInfo) {
    throw new Error("Không tìm thấy lớp học");
  }

  const updateData = { ...data };

  if (updateData.name) {
    const normalizedName = normalizeClassName(updateData.name);
    if (!normalizedName) {
      throw new Error("Tên lớp không hợp lệ sau khi chuẩn hóa");
    }
    if (normalizedName !== classInfo.name) {
      const existingClass = await Class.findOne({
        name: normalizedName,
        schoolYearId: classInfo.schoolYearId,
        status: "active"
      });
      if (existingClass) {
        throw new Error(`Lớp "${normalizedName}" đã tồn tại trong năm học này`);
      }
    }
    updateData.name = normalizedName;
    if (!updateData.grade) {
      const extractedGrade = extractGradeFromClassName(normalizedName);
      if (extractedGrade) {
        updateData.grade = extractedGrade;
      }
    }
  }

  if (updateData.grade) {
    updateData.grade = updateData.grade.toString().trim();
  }

  if (updateData.studentCount !== undefined) {
    updateData.studentCount = Number.isFinite(Number(updateData.studentCount)) ? parseInt(updateData.studentCount, 10) : 0;
  }

  updateData.updatedAt = Date.now();

  const updatedClass = await Class.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
  return updatedClass;
};

const deleteClass = async (id) => {
  if (!id) {
    throw new Error("ID lớp học là bắt buộc");
  }
  const classInfo = await Class.findById(id);
  if (!classInfo) {
    throw new Error("Không tìm thấy lớp học");
  }
  await Class.findByIdAndDelete(id);
  return {
    message: "Xóa lớp học thành công",
    deletedClass: {
      id: classInfo._id,
      name: classInfo.name
    }
  };
};

const getRowValue = (row, fieldName) => {
  if (!row || !fieldName) return null;
  const key = Object.keys(row).find(k => k.toLowerCase() === fieldName.toLowerCase());
  return key ? row[key] : null;
};

const importClasses = async (file) => {
  if (!file) {
    throw new Error("Vui lòng tải lên file Excel");
  }

  const XLSX = require("xlsx");
  const schoolYearId = await getActiveSchoolYearId();

  const workbook = XLSX.read(file.buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("File Excel trống");
  }

  const results = {
    success: [],
    failed: []
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 2;
    try {
      const name = getRowValue(row, "Tên lớp") || getRowValue(row, "Ten lop") || getRowValue(row, "name");
      let grade = getRowValue(row, "Khối") || getRowValue(row, "Khoi") || getRowValue(row, "grade");
      const studentCountRaw = getRowValue(row, "Sĩ số") || getRowValue(row, "Si so") || getRowValue(row, "studentCount");

      if (!name) {
        results.failed.push({ row: rowNumber, data: row, reason: "Thiếu tên lớp" });
        continue;
      }

      const normalizedName = normalizeClassName(name);
      if (!normalizedName) {
        results.failed.push({ row: rowNumber, data: row, reason: "Tên lớp không hợp lệ sau khi chuẩn hóa" });
        continue;
      }

      if (!grade) {
        const extractedGrade = extractGradeFromClassName(normalizedName);
        if (extractedGrade) {
          grade = extractedGrade;
        } else {
          results.failed.push({
            row: rowNumber,
            data: row,
            reason: `Không thể xác định khối từ tên lớp "${normalizedName}". Vui lòng nhập khối hoặc đặt tên theo định dạng: 10A1, 11B2,...`
          });
          continue;
        }
      }

      const existingClass = await Class.findOne({
        name: normalizedName,
        schoolYearId,
        status: "active"
      });

      if (existingClass) {
        const schoolYear = await SchoolYear.findById(schoolYearId);
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: `Tên lớp "${normalizedName}" đã tồn tại trong năm học ${schoolYear?.year || "hiện tại"}`
        });
        continue;
      }

      const studentCount = Number.isFinite(Number(studentCountRaw)) ? parseInt(studentCountRaw, 10) : 0;

      const classInfo = await Class.create({
        name: normalizedName,
        grade: grade.toString().trim(),
        studentCount,
        schoolYearId,
        status: "active"
      });

      results.success.push({
        row: rowNumber,
        class: classInfo,
        originalName: name,
        normalizedName
      });
    } catch (error) {
      results.failed.push({
        row: rowNumber,
        data: row,
        reason: error?.message || "Lỗi không xác định"
      });
    }
  }

  return {
    total: data.length,
    successCount: results.success.length,
    failedCount: results.failed.length,
    success: results.success,
    failed: results.failed
  };
};

module.exports = {
  getClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
  importClasses,
  normalizeClassName
};