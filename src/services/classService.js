const Class = require("../models/classesModel");
const SchoolYear = require("../models/schoolYearModel");

// ✅ Hàm chuẩn hóa tên lớp: 10A3, 10a3, 10 a3, 10 A3 → 10A3
const normalizeClassName = (name) => {
  if (!name) return null;
  
  // Loại bỏ khoảng trắng thừa và chuyển thành chữ hoa
  let normalized = name.toString().trim().replace(/\s+/g, '').toUpperCase();
  
  // Tách số khối và tên lớp (VD: "10A3" → "10" + "A3")
  const match = normalized.match(/^(\d{1,2})([A-Z]\d{0,2})$/);
  
  if (match) {
    const grade = match[1];      // "10"
    const className = match[2];  // "A3"
    normalized = grade + className;
  }
  
  return normalized;
};

const getActiveSchoolYearId = async () => {
  const activeYear = await SchoolYear.findOne({ status: 'active' });
  if (!activeYear) {
    throw new Error('Không có năm học đang hoạt động. Vui lòng tạo năm học mới!');
  }
  return activeYear._id;
};

const extractGradeFromClassName = (className) => {
  if (!className) return null;
  const match = className.trim().match(/^(\d{1,2})/);
  if (match) return match[1];
  return null;
};

// ✅ GET classes
const getClasses = async (filters = {}) => {
  const schoolYearId = filters.schoolYearId || await getActiveSchoolYearId();
  
  const query = {
    schoolYearId
  };

  // ✅ Chuẩn hóa tên lớp khi search
  if (filters.name) {
    const normalizedSearchName = normalizeClassName(filters.name);
    query.name = { $regex: normalizedSearchName, $options: "i" };
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

// ✅ CREATE class với chuẩn hóa tên
const createClass = async (data) => {
  const { name, grade, studentCount } = data;
  const schoolYearId = await getActiveSchoolYearId();

  if (!name) {
    throw new Error("Class name is required");
  }

  // ✅ Chuẩn hóa tên lớp: 10a3, 10 A3, 10 a3 → 10A3
  const normalizedName = normalizeClassName(name);

  if (!normalizedName) {
    throw new Error("Class name cannot be empty after normalization");
  }

  let finalGrade = grade;
  if (!finalGrade) {
    const extractedGrade = extractGradeFromClassName(normalizedName);
    if (extractedGrade) {
      finalGrade = extractedGrade;
    } else {
      throw new Error("Không thể xác định khối từ tên lớp. Vui lòng nhập khối hoặc đặt tên lớp theo định dạng: 10A1, 11B2, 6C,...");
    }
  }

  // ✅ Kiểm tra tên lớp đã tồn tại (sau khi chuẩn hóa)
  const existingClass = await Class.findOne({ 
    name: normalizedName, 
    schoolYearId,
    status: 'active' 
  });
  
  if (existingClass) {
    throw new Error(`Lớp "${normalizedName}" đã tồn tại trong năm học này`);
  }

  // ✅ Lưu tên đã chuẩn hóa
  const classInfo = await Class.create({
    name: normalizedName,  // ← Lưu tên đã chuẩn hóa
    grade: finalGrade.toString().trim(),
    studentCount: studentCount ? parseInt(studentCount) : 0,
    schoolYearId,
    status: 'active'
  });

  return classInfo;
};

// ✅ UPDATE class với chuẩn hóa tên
const updateClass = async (id, data) => {
  if (!id) {
    throw new Error("Class ID is required");
  }

  const classInfo = await Class.findById(id);
  if (!classInfo) {
    throw new Error("Class not found");
  }

  if (data.name) {
    // ✅ Chuẩn hóa tên lớp
    const normalizedName = normalizeClassName(data.name);
    
    if (!normalizedName) {
      throw new Error("Class name cannot be empty after normalization");
    }

    if (normalizedName !== classInfo.name) {
      const existingClass = await Class.findOne({ 
        name: normalizedName, 
        schoolYearId: classInfo.schoolYearId,
        status: 'active' 
      });
      
      if (existingClass) {
        throw new Error(`Lớp "${normalizedName}" đã tồn tại trong năm học này`);
      }
      
      data.name = normalizedName;  // ← Lưu tên đã chuẩn hóa
      
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

// ✅ IMPORT classes với chuẩn hóa tên
const importClasses = async (file) => {
  if (!file) {
    throw new Error("No file uploaded");
  }

  const XLSX = require("xlsx");
  const schoolYearId = await getActiveSchoolYearId();

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
      let grade = getRowValue(row, "Khối");
      const studentCount = getRowValue(row, "Sĩ số");

      if (!name) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: "Thiếu tên lớp",
        });
        continue;
      }

      // ✅ Chuẩn hóa tên lớp
      const normalizedName = normalizeClassName(name);

      if (!normalizedName) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: "Tên lớp không hợp lệ sau khi chuẩn hóa",
        });
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
            reason: `Không thể xác định khối từ tên lớp "${normalizedName}". Vui lòng nhập khối hoặc đặt tên theo định dạng: 10A1, 11B2,...`,
          });
          continue;
        }
      }

      // ✅ Kiểm tra trùng lặp với tên đã chuẩn hóa
      const existingClass = await Class.findOne({ 
        name: normalizedName, 
        schoolYearId,
        status: 'active' 
      });
      
      if (existingClass) {
        const schoolYear = await SchoolYear.findById(schoolYearId);
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: `Tên lớp "${normalizedName}" đã tồn tại trong năm học ${schoolYear?.year || 'hiện tại'}`,
        });
        continue;
      }

      const classInfo = await Class.create({
        name: normalizedName,  // ← Lưu tên đã chuẩn hóa
        grade: grade.toString().trim(),
        studentCount: studentCount ? parseInt(studentCount) : 0,
        schoolYearId,
        status: 'active'
      });

      results.success.push({
        row: rowNumber,
        class: classInfo,
        originalName: name,        // Tên gốc từ Excel
        normalizedName: normalizedName  // Tên sau khi chuẩn hóa
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
  normalizeClassName,  // Export để có thể dùng ở nơi khác nếu cần
};