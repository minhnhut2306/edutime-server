const TeachingRecords = require("../models/teachingRecordsModel");
const Teacher = require("../models/teacherModel");
const Week = require("../models/weekModel");
const Subject = require("../models/subjectModel");
const Class = require("../models/classesModel");
const mongoose = require('mongoose');

const POPULATE_OPTIONS = [
  { path: "teacherId", select: "name email phone" },
  { path: "weekId", select: "weekNumber startDate endDate schoolYearId" },
  { path: "subjectId", select: "name code" },
  { path: "classId", select: "name grade studentCount" }
];

const MAX_PERIODS_PER_WEEK = 20;

const validatePeriods = (periods) => {
  if (periods !== undefined && (periods < 1 || periods > MAX_PERIODS_PER_WEEK)) {
    throw new Error(`Tổng số tiết không được vượt quá ${MAX_PERIODS_PER_WEEK}`);
  }
};

const checkWeekPeriodLimit = async (teacherId, weekId, newPeriods, excludeRecordId = null) => {
  const query = { teacherId, weekId };
  if (excludeRecordId) {
    query._id = { $ne: excludeRecordId };
  }

  const existingRecords = await TeachingRecords.find(query);
  const totalExistingPeriods = existingRecords.reduce((sum, record) => sum + (record.periods || 0), 0);
  const totalPeriods = totalExistingPeriods + newPeriods;

  if (totalPeriods > MAX_PERIODS_PER_WEEK) {
    throw new Error(
      `Tổng số tiết trong tuần này đã đạt ${totalExistingPeriods}. ` +
      `Thêm ${newPeriods} tiết sẽ vượt quá giới hạn ${MAX_PERIODS_PER_WEEK} tiết/tuần. ` +
      `Bạn chỉ có thể thêm tối đa ${MAX_PERIODS_PER_WEEK - totalExistingPeriods} tiết nữa.`
    );
  }
};

const validateTeacherGrade = (teacher, classGrade) => {
  if (
    Array.isArray(teacher.allowedGrades) &&
    teacher.allowedGrades.length > 0 &&
    !teacher.allowedGrades.includes(classGrade)
  ) {
    throw new Error(
      `Bạn không có quyền dạy khối ${classGrade}. Chỉ được dạy khối: ${teacher.allowedGrades.join(", ")}`
    );
  }
};

const checkDuplicateRecord = async (teacherId, weekId, subjectId, classId, excludeId = null) => {   
  const query = { teacherId, weekId, classId };
  if (excludeId) query._id = { $ne: excludeId };
  
  const existing = await TeachingRecords.findOne(query);
  if (existing) {
    throw new Error("Bạn đã có bản ghi cho lớp này trong tuần học này rồi");
  }
};

const validateEntities = async (teacherId, weekId, subjectId, classId) => {
  const [teacher, week, subject, classData] = await Promise.all([
    Teacher.findById(teacherId),
    Week.findById(weekId),
    Subject.findById(subjectId),
    Class.findById(classId)
  ]);

  if (!teacher) throw new Error("Không tìm thấy giáo viên");
  if (!week) throw new Error("Không tìm thấy tuần học");
  if (!subject) throw new Error("Không tìm thấy môn học");
  if (!classData) throw new Error("Không tìm thấy lớp học");

  return { teacher, week, subject, classData };
};

const buildQueryFilters = (filters = {}) => {
  const query = {};
  
  if (filters.schoolYearId) {
    query.schoolYearId = filters.schoolYearId;
  }
  
  if (filters.weekId) {
    query.weekId = filters.weekId;
  }
  
  if (filters.classId) {
    query.classId = filters.classId;
  }
  
  if (filters.subjectId) {
    query.subjectId = filters.subjectId;
  }
  
  if (filters.recordType) {
    query.recordType = filters.recordType;
  }
  
  return query;
};

// ✅ FIX: Sort tất cả records trước, sau đó mới phân trang
const getAllTeachingRecords = async (filters = {}, pagination = { page: 1, limit: 10 }) => {
  try {
    const query = buildQueryFilters(filters);
    
    // Handle semester filter
    if (filters.semester && filters.schoolYearId) {
      const semesterMap = {
        '1': { start: 1, end: 18 },
        '2': { start: 19, end: 36 }
      };
      
      const range = semesterMap[filters.semester];
      if (range) {
        const weeks = await Week.find({
          schoolYearId: filters.schoolYearId,
          weekNumber: { $gte: range.start, $lte: range.end }
        }).select('_id');
        
        const weekIds = weeks.map(w => w._id);
        query.weekId = { $in: weekIds };
      }
    }

    // ✅ Step 1: Lấy TẤT CẢ records và populate
    const allRecords = await TeachingRecords.find(query)
      .populate(POPULATE_OPTIONS);

    // ✅ Step 2: Sort theo weekNumber
    allRecords.sort((a, b) => {
      const weekNumA = a.weekId?.weekNumber || 0;
      const weekNumB = b.weekId?.weekNumber || 0;
      return weekNumA - weekNumB;
    });

    // ✅ Step 3: Áp dụng pagination sau khi đã sort
    const page = parseInt(pagination.page, 10) || 1;
    const limit = parseInt(pagination.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedRecords = allRecords.slice(startIndex, endIndex);
    const total = allRecords.length;

    return { 
      success: true, 
      data: {
        records: paginatedRecords,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

// ✅ FIX: Tương tự cho getTeachingRecordsByTeacher
const getTeachingRecordsByTeacher = async (teacherId, filters = {}, pagination = { page: 1, limit: 10 }) => {
  try {
    if (!teacherId) {
      return { success: true, data: { records: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } } };
    }

    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
      return {
        success: false,
        statusCode: 400,
        message: "Không tìm thấy thông tin giáo viên"
      };
    }

    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giáo viên"
      };
    }
    
    const query = { teacherId, ...buildQueryFilters(filters) };
    
    // Handle semester filter
    if (filters.semester && filters.schoolYearId) {
      const semesterMap = {
        '1': { start: 1, end: 18 },
        '2': { start: 19, end: 36 }
      };
      
      const range = semesterMap[filters.semester];
      if (range) {
        const weeks = await Week.find({
          schoolYearId: filters.schoolYearId,
          weekNumber: { $gte: range.start, $lte: range.end }
        }).select('_id');
        
        const weekIds = weeks.map(w => w._id);
        query.weekId = { $in: weekIds };
      }
    }

    // ✅ Step 1: Lấy TẤT CẢ records và populate
    const allRecords = await TeachingRecords.find(query)
      .populate(POPULATE_OPTIONS);

    // ✅ Step 2: Sort theo weekNumber
    allRecords.sort((a, b) => {
      const weekNumA = a.weekId?.weekNumber || 0;
      const weekNumB = b.weekId?.weekNumber || 0;
      return weekNumA - weekNumB;
    });

    // ✅ Step 3: Áp dụng pagination sau khi đã sort
    const page = parseInt(pagination.page, 10) || 1;
    const limit = parseInt(pagination.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedRecords = allRecords.slice(startIndex, endIndex);
    const total = allRecords.length;

    return { 
      success: true, 
      data: {
        records: paginatedRecords,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

const createTeachingRecord = async (data) => {
  try {
    const {
      teacherId,
      weekId,
      subjectId,
      classId,
      periods,
      schoolYearId,
      createdBy,
      recordType,
      notes
    } = data;

    validatePeriods(periods);

    const { teacher, classData } = await validateEntities(
      teacherId,
      weekId,
      subjectId,
      classId
    );

    validateTeacherGrade(teacher, classData.grade);

    await checkWeekPeriodLimit(teacherId, weekId, periods);

    await checkDuplicateRecord(teacherId, weekId, subjectId, classId);

    const newRecord = await TeachingRecords.create({
      teacherId,
      weekId,
      subjectId,
      classId,
      periods,
      schoolYearId,
      createdBy,
      recordType: recordType || "teaching",
      notes: notes || ""
    });

    const populatedRecord = await TeachingRecords.findById(newRecord._id)
      .populate(POPULATE_OPTIONS);

    return { success: true, data: populatedRecord };
  } catch (err) {
    const statusCode = err.message.includes("không tìm thấy") ? 404 :
                      err.message.includes("không có quyền") ? 403 :
                      err.message.includes("đã tồn tại") ? 409 :
                      err.message.includes("vượt quá giới hạn") || err.message.includes("Tổng số tiết") ? 400 : 400;
    return { success: false, statusCode, message: err.message };
  }
};

const updateTeachingRecord = async (recordId, data, currentTeacherId) => {
  try {
    const {
      teacherId,
      weekId,
      subjectId,
      classId,
      periods,
      schoolYearId,
      recordType,
      notes
    } = data;

    const record = await TeachingRecords.findById(recordId);
    if (!record) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy bản ghi"
      };
    }

    if (currentTeacherId && record.teacherId.toString() !== currentTeacherId.toString()) {
      return {
        success: false,
        statusCode: 403,
        message: "Bạn chỉ có quyền sửa bản ghi của chính mình"
      };
    }

    validatePeriods(periods);

    const targetTeacherId = teacherId || record.teacherId;
    const targetWeekId = weekId || record.weekId;
    const targetClassId = classId || record.classId;

    const { teacher, classData } = await validateEntities(
      targetTeacherId,
      targetWeekId,
      subjectId || record.subjectId,
      targetClassId
    );

    validateTeacherGrade(teacher, classData.grade);

    if (periods !== undefined) {
      await checkWeekPeriodLimit(targetTeacherId, targetWeekId, periods, recordId);
    }

    await checkDuplicateRecord(
      teacherId || record.teacherId,
      weekId || record.weekId,
      subjectId || record.subjectId,
      classId || record.classId,
      recordId
    );

    if (teacherId) record.teacherId = teacherId;
    if (weekId) record.weekId = weekId;
    if (subjectId) record.subjectId = subjectId;
    if (classId) record.classId = classId;
    if (periods !== undefined) record.periods = periods;
    if (schoolYearId) record.schoolYearId = schoolYearId;
    if (recordType !== undefined) record.recordType = recordType;
    if (notes !== undefined) record.notes = notes;

    record.updatedAt = new Date();
    await record.save();

    const populatedRecord = await TeachingRecords.findById(record._id)
      .populate(POPULATE_OPTIONS);

    return { success: true, data: populatedRecord };
  } catch (err) {
    const statusCode = err.message.includes("không tìm thấy") ? 404 :
                      err.message.includes("không có quyền") || err.message.includes("chỉ có quyền") ? 403 :
                      err.message.includes("đã tồn tại") ? 409 :
                      err.message.includes("vượt quá giới hạn") || err.message.includes("Tổng số tiết") ? 400 : 400;
    return { success: false, statusCode, message: err.message };
  }
};

const deleteTeachingRecord = async (recordId, currentTeacherId) => {
  try {
    const record = await TeachingRecords.findById(recordId);
    if (!record) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy bản ghi"
      };
    }

    if (currentTeacherId && record.teacherId.toString() !== currentTeacherId.toString()) {
      return {
        success: false,
        statusCode: 403,
        message: "Bạn chỉ có thể xóa bản ghi của chính mình"
      };
    }

    await TeachingRecords.findByIdAndDelete(recordId);
    return { success: true, data: { deletedId: recordId } };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

module.exports = {
  getAllTeachingRecords,
  getTeachingRecordsByTeacher,
  createTeachingRecord,
  updateTeachingRecord,
  deleteTeachingRecord
};  