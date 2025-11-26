const Class = require("../models/classesModel");
const SchoolYear = require("../models/schoolYearModel");
const XLSX = require("xlsx");

// ✅ THAY ĐỔI 1: Helper function trả về ID thay vì string
// ❌ CŨ: const getActiveSchoolYear = async () => { return activeYear.year; }
const getActiveSchoolYearId = async () => {
  const activeYear = await SchoolYear.findOne({ status: 'active' });
  if (!activeYear) {
    throw new Error('Không có năm học đang hoạt động. Vui lòng tạo năm học mới!');
  }
  return activeYear._id;  // ✅ Trả về _id thay vì year
};

const extractGradeFromClassName = (className) => {
  if (!className) return null;
  const match = className.trim().match(/^(\d{1,2})/);
  if (match) return match[1];
  return null;
};

// ✅ THAY ĐỔI 2: getClasses
const getClasses = async (filters = {}) => {
  const schoolYearId = await getActiveSchoolYearId();  // ✅ Đổi tên biến
  
  const query = {
    schoolYearId
  };

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

// ✅ THAY ĐỔI 3: createClass
const createClass = async (data) => {
  const { name, grade, studentCount } = data;
  const schoolYearId = await getActiveSchoolYearId();  // ✅ Đổi tên biến

  if (!name) {
    throw new Error("Class name is required");
  }

  const trimmedName = name.toString().trim();

  if (!trimmedName) {
    throw new Error("Class name cannot be empty");
  }

  let finalGrade = grade;
  if (!finalGrade) {
    const extractedGrade = extractGradeFromClassName(trimmedName);
    if (extractedGrade) {
      finalGrade = extractedGrade;
    } else {
      throw new Error("Không thể xác định khối từ tên lớp. Vui lòng nhập khối hoặc đặt tên lớp theo định dạng: 10A1, 11B2, 6C,...");
    }
  }

  const existingClass = await Class.findOne({ 
    name: trimmedName, 
    schoolYearId,  // ✅ Đổi tên field
    status: 'active' 
  });
  
  if (existingClass) {
    throw new Error("Class name already exists");
  }

  const classInfo = await Class.create({
    name: trimmedName,
    grade: finalGrade.toString().trim(),
    studentCount: studentCount ? parseInt(studentCount) : 0,
    schoolYearId,      // ✅ Đổi tên field
    status: 'active'
  });

  return classInfo;
};

// ✅ THAY ĐỔI 4: updateClass
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
      const existingClass = await Class.findOne({ 
        name: trimmedName, 
        schoolYearId: classInfo.schoolYearId,  // ✅ Đổi tên field
        status: 'active' 
      });
      
      if (existingClass) {
        throw new Error("Class name already exists");
      }
      data.name = trimmedName;
      
      if (!data.grade) {
        const extractedGrade = extractGradeFromClassName(trimmedName);
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

// ✅ THAY ĐỔI 5: importClasses
const importClasses = async (file) => {
  if (!file) {
    throw new Error("No file uploaded");
  }

  const schoolYearId = await getActiveSchoolYearId();  // ✅ Đổi tên biến

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

      const trimmedName = name.toString().trim();

      if (!trimmedName) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: "Tên lớp không được để trống",
        });
        continue;
      }

      if (!grade) {
        const extractedGrade = extractGradeFromClassName(trimmedName);
        if (extractedGrade) {
          grade = extractedGrade;
        } else {
          results.failed.push({
            row: rowNumber,
            data: row,
            reason: `Không thể xác định khối từ tên lớp "${trimmedName}". Vui lòng nhập khối hoặc đặt tên theo định dạng: 10A1, 11B2,...`,
          });
          continue;
        }
      }

      const existingClass = await Class.findOne({ 
        name: trimmedName, 
        schoolYearId,  // ✅ Đổi tên field
        status: 'active' 
      });
      
      if (existingClass) {
        // ✅ Lấy year để hiển thị message
        const schoolYear = await SchoolYear.findById(schoolYearId);
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: `Tên lớp "${trimmedName}" đã tồn tại trong năm học ${schoolYear?.year || 'hiện tại'}`,
        });
        continue;
      }

      const classInfo = await Class.create({
        name: trimmedName,
        grade: grade.toString().trim(),
        studentCount: studentCount ? parseInt(studentCount) : 0,
        schoolYearId,      // ✅ Đổi tên field
        status: 'active'
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
