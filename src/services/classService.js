const Class = require("../models/classesModel");
const SchoolYear = require("../models/schoolYearModel");
const Teacher = require("../models/teacherModel");
const TeachingRecords = require("../models/teachingRecordsModel");

const XLSX = require("xlsx");

const normalizeClassName = (name) => {
  if (!name) return null;

  const normalized = name.toString().trim().replace(/\s+/g, "").toUpperCase();
  const match = normalized.match(/^(\d{1,2})([A-Z]\d{0,2})$/);

  return match ? match[1] + match[2] : normalized;
};

const extractGradeFromClassName = (className) => {
  if (!className) return null;
  const match = className.trim().match(/^(\d{1,2})/);
  return match ? match[1] : null;
};

const getActiveSchoolYearId = async () => {
  const activeYear = await SchoolYear.findOne({ status: "active" });
  if (!activeYear) {
    throw new Error(
      "Không có năm học đang hoạt động. Vui lòng tạo năm học mới!"
    );
  }
  return activeYear._id;
};

const checkDuplicateClass = async (
  normalizedName,
  schoolYearId,
  excludeId = null
) => {
  const query = {
    name: normalizedName,
    schoolYearId,
    status: "active",
  };

  if (excludeId) query._id = { $ne: excludeId };

  const existingClass = await Class.findOne(query);
  if (existingClass) {
    throw new Error(`Lớp "${normalizedName}" đã tồn tại trong năm học này`);
  }
};

const getRowValue = (row, fieldName) => {
  const key = Object.keys(row).find(
    (k) => k.toLowerCase() === fieldName.toLowerCase()
  );
  return key ? row[key] : null;
};

const getClasses = async (filters = {}) => {
  const schoolYearId = filters.schoolYearId || (await getActiveSchoolYearId());

  const query = { schoolYearId };

  if (filters.name) {
    const normalizedSearchName = normalizeClassName(filters.name);
    query.name = { $regex: normalizedSearchName, $options: "i" };
  }

  if (filters.grade) {
    query.grade = filters.grade;
  }

  return await Class.find(query).sort({ createdAt: -1 });
};

const getClassById = async (id) => {
  if (!id) throw new Error("ID lớp học là bắt buộc");

  const classInfo = await Class.findById(id);
  if (!classInfo) throw new Error("Không tìm thấy lớp học");

  return classInfo;
};

const createClass = async (data) => {
  const { name, grade, studentCount } = data;
  const schoolYearId = await getActiveSchoolYearId();

  if (!name) throw new Error("Tên lớp là bắt buộc");

  const normalizedName = normalizeClassName(name);
  if (!normalizedName) {
    throw new Error("Tên lớp không hợp lệ sau khi chuẩn hóa");
  }

  let finalGrade = grade;
  if (!finalGrade) {
    const extractedGrade = extractGradeFromClassName(normalizedName);
    if (!extractedGrade) {
      throw new Error(
        "Không thể xác định khối từ tên lớp. Vui lòng nhập khối hoặc đặt tên lớp theo định dạng: 10A1, 11B2, 6C,..."
      );
    }
    finalGrade = extractedGrade;
  }

  await checkDuplicateClass(normalizedName, schoolYearId);

  return await Class.create({
    name: normalizedName,
    grade: finalGrade.toString().trim(),
    studentCount: studentCount ? parseInt(studentCount) : 0,
    schoolYearId,
    status: "active",
  });
};

const updateClass = async (id, data) => {
  if (!id) throw new Error("ID lớp học là bắt buộc");

  const classInfo = await Class.findById(id);
  if (!classInfo) throw new Error("Không tìm thấy lớp học");

  if (data.name) {
    const normalizedName = normalizeClassName(data.name);

    if (!normalizedName) {
      throw new Error("Tên lớp không hợp lệ sau khi chuẩn hóa");
    }

    if (normalizedName !== classInfo.name) {
      await checkDuplicateClass(normalizedName, classInfo.schoolYearId, id);

      data.name = normalizedName;

      if (!data.grade) {
        const extractedGrade = extractGradeFromClassName(normalizedName);
        if (extractedGrade) {
          data.grade = extractedGrade;
        }
      }
    }
  }

  if (data.grade) {
    data.grade = data.grade.toString().trim();
  }

  return await Class.findByIdAndUpdate(
    id,
    { ...data, updatedAt: Date.now() },
    { new: true, runValidators: true }
  );
};

const deleteClass = async (id) => {
  if (!id) throw new Error("ID lớp học là bắt buộc");

  const classInfo = await Class.findById(id);
  if (!classInfo) throw new Error("Không tìm thấy lớp học");

  const teacherWithMainClass = await Teacher.findOne({ mainClassId: id });
  if (teacherWithMainClass) {
    throw new Error(
      `Không thể xóa lớp "${classInfo.name}" vì đang có giáo viên "${teacherWithMainClass.name}" làm chủ nhiệm. Vui lòng bỏ chủ nhiệm trước khi xóa lớp.`
    );
  }

  const teachingRecordsCount = await TeachingRecords.countDocuments({ classId: id });
  if (teachingRecordsCount > 0) {
    throw new Error(
      `Không thể xóa lớp "${classInfo.name}" vì có ${teachingRecordsCount} bản ghi giảng dạy liên quan. Vui lòng xóa các bản ghi giảng dạy trước.`
    );
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

const processImportRow = async (row, rowNumber, schoolYearId) => {
  const name = getRowValue(row, "Tên lớp");
  let grade = getRowValue(row, "Khối");
  const studentCount = getRowValue(row, "Sĩ số");

  if (!name) {
    throw new Error("Thiếu tên lớp");
  }

  const normalizedName = normalizeClassName(name);
  if (!normalizedName) {
    throw new Error("Tên lớp không hợp lệ sau khi chuẩn hóa");
  }

  if (!grade) {
    const extractedGrade = extractGradeFromClassName(normalizedName);
    if (!extractedGrade) {
      throw new Error(
        `Không thể xác định khối từ tên lớp "${normalizedName}". Vui lòng nhập khối hoặc đặt tên theo định dạng: 10A1, 11B2,...`
      );
    }
    grade = extractedGrade;
  }

  const existingClass = await Class.findOne({
    name: normalizedName,
    schoolYearId,
    status: "active",
  });

  if (existingClass) {
    const schoolYear = await SchoolYear.findById(schoolYearId);
    throw new Error(
      `Tên lớp "${normalizedName}" đã tồn tại trong năm học ${
        schoolYear?.year || "hiện tại"
      }`
    );
  }

  const classInfo = await Class.create({
    name: normalizedName,
    grade: grade.toString().trim(),
    studentCount: studentCount ? parseInt(studentCount) : 0,
    schoolYearId,
    status: "active",
  });

  return {
    row: rowNumber,
    class: classInfo,
    originalName: name,
    normalizedName: normalizedName,
  };
};

const importClasses = async (file) => {
  if (!file) throw new Error("Không có file được tải lên");

  const schoolYearId = await getActiveSchoolYearId();

  const workbook = XLSX.read(file.buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);

  if (data.length === 0) {
    throw new Error("File Excel trống");
  }

  const results = {
    success: [],
    failed: [],
  };

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 2;

    try {
      const result = await processImportRow(row, rowNumber, schoolYearId);
      results.success.push(result);
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
  normalizeClassName,
};
