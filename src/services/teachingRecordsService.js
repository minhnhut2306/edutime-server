const TeachingRecords = require("../models/teachingRecordsModel");
const Teacher = require("../models/teacherModel");
const Week = require("../models/weekModel");
const Subject = require("../models/subjectModel");
const Class = require("../models/classesModel");

const getAllTeachingRecords = async () => {
  try {
    const records = await TeachingRecords.find({})
      .populate("weekId", "weekNumber startDate endDate schoolYearId")
      .populate("subjectId", "name code")
      .populate("classId", "name grade")
      .sort({ createdAt: -1 });

    return { success: true, data: records };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

const getTeachingRecordsByTeacher = async (teacherId) => {
  try {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giáo viên",
      };
    }
    const records = await TeachingRecords.find({ teacherId })
      .populate("weekId", "weekNumber startDate endDate schoolYearId")
      .populate("subjectId", "name code")
      .populate("classId", "name grade")
      .sort({ createdAt: -1 });

    return { success: true, data: records, total: records.length };
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
      notes,
    } = data;

    console.log("📥 CREATE - Data nhận vào:", {
      teacherId,
      weekId,
      subjectId,
      classId,
      periods,
      schoolYearId,
      recordType: recordType || "teaching",
      notes: notes || "",
      createdBy,
    });

    const [teacher, week, subject, classData, existingRecord] =
      await Promise.all([
        Teacher.findById(teacherId),
        Week.findById(weekId),
        Subject.findById(subjectId),
        Class.findById(classId),
        TeachingRecords.findOne({ teacherId, weekId, subjectId, classId }),
      ]);

    if (!teacher) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giáo viên",
      };
    }
    if (!week) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy tuần học",
      };
    }
    if (!subject) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy môn học",
      };
    }
    if (!classData) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy lớp học",
      };
    }
    if (
      Array.isArray(teacher.allowedGrades) &&
      teacher.allowedGrades.length > 0 &&
      !teacher.allowedGrades.includes(classData.grade)
    ) {
      return {
        success: false,
        statusCode: 403,
        message: `Bạn không có quyền dạy khối ${
          classData.grade
        }. Chỉ được dạy khối: ${teacher.allowedGrades.join(", ")}`,
      };
    }
    if (existingRecord) {
      return {
        success: false,
        statusCode: 409,
        message: "Bản ghi này đã tồn tại (cùng tuần, môn học và lớp)",
      };
    }

    // ✅ Kiểm tra tổng số tiết trong tuần không vượt quá 17
    const existingPeriodsInWeek = await TeachingRecords.aggregate([
      {
        $match: {
          teacherId: teacher._id,
          weekId: week._id,
        },
      },
      {
        $group: {
          _id: null,
          totalPeriods: { $sum: "$periods" },
        },
      },
    ]);

    const currentTotal =
      existingPeriodsInWeek.length > 0
        ? existingPeriodsInWeek[0].totalPeriods
        : 0;
    const newTotal = currentTotal + periods;

    if (newTotal > 17) {
      return {
        success: false,
        statusCode: 400,
        message: `❌ Vượt quá giới hạn 17 tiết/tuần!\n\nTuần ${
          week.weekNumber
        }: Đã có ${currentTotal} tiết, thêm ${periods} tiết sẽ vượt quá giới hạn (tổng: ${newTotal} tiết).\n\nVui lòng nhập tối đa ${
          17 - currentTotal
        } tiết.`,
      };
    }

    console.log(
      `✅ Kiểm tra tuần ${week.weekNumber}: ${currentTotal} + ${periods} = ${newTotal}/17 tiết`
    );

    const newRecord = await TeachingRecords.create({
      teacherId,
      weekId,
      subjectId,
      classId,
      periods,
      schoolYearId,
      createdBy,
      recordType: recordType || "teaching",
      notes: notes || "",
    });

    console.log("✅ CREATE - Bản ghi đã tạo:", {
      id: newRecord._id,
      recordType: newRecord.recordType,
      notes: newRecord.notes,
      periods: newRecord.periods,
    });

    const populatedRecord = await TeachingRecords.findById(newRecord._id)
      .populate("weekId", "weekNumber startDate endDate schoolYearId")
      .populate("subjectId", "name code")
      .populate("classId", "name grade");

    console.log("✅ CREATE - Bản ghi sau populate:", {
      id: populatedRecord._id,
      recordType: populatedRecord.recordType,
      notes: populatedRecord.notes,
    });

    return { success: true, data: populatedRecord };
  } catch (err) {
    return { success: false, message: err.message };
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
      notes,
    } = data;

    console.log("📥 UPDATE - Data nhận vào:", {
      recordId,
      teacherId,
      weekId,
      subjectId,
      classId,
      periods,
      schoolYearId,
      recordType,
      notes,
      currentTeacherId,
    });

    const record = await TeachingRecords.findById(recordId);
    if (!record) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy bản ghi",
      };
    }

    console.log("📄 UPDATE - Bản ghi hiện tại:", {
      id: record._id,
      recordType: record.recordType,
      notes: record.notes,
      periods: record.periods,
    });

    if (currentTeacherId) {
      if (record.teacherId.toString() !== currentTeacherId.toString()) {
        return {
          success: false,
          statusCode: 403,
          message: "Bạn chỉ có quyền sửa bản ghi của chính mình",
        };
      }
    }

    if (periods !== undefined && (periods < 1 || periods > 20)) {
      return {
        success: false,
        statusCode: 400,
        message: "Số tiết phải từ 1 đến 20",
      };
    }
    if (schoolYearId !== undefined) {
      const schoolYearIdRegex = /^\d{4}-\d{4}$/;
      if (!schoolYearIdRegex.test(schoolYearId)) {
        return {
          success: false,
          statusCode: 400,
          message: "Năm học không đúng định dạng (VD: 2024-2025)",
        };
      }
    }

    const targetTeacherId = teacherId || record.teacherId;
    const teacher = await Teacher.findById(targetTeacherId);
    if (!teacher) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giáo viên",
      };
    }

    const targetClassId = classId || record.classId;
    const classData = await Class.findById(targetClassId);
    if (!classData) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy lớp học",
      };
    }
    if (
      teacher.allowedGrades &&
      teacher.allowedGrades.length > 0 &&
      !teacher.allowedGrades.includes(classData.grade)
    ) {
      return {
        success: false,
        statusCode: 403,
        message: `Bạn không có quyền dạy khối ${
          classData.grade
        }. Chỉ được dạy khối: ${teacher.allowedGrades.join(", ")}`,
      };
    }

    if (weekId) {
      const week = await Week.findById(weekId);
      if (!week)
        return {
          success: false,
          statusCode: 404,
          message: "Không tìm thấy tuần học",
        };
    }
    if (subjectId) {
      const subject = await Subject.findById(subjectId);
      if (!subject)
        return {
          success: false,
          statusCode: 404,
          message: "Không tìm thấy môn học",
        };
    }

    const existing = await TeachingRecords.findOne({
      _id: { $ne: recordId },
      teacherId: teacherId || record.teacherId,
      weekId: weekId || record.weekId,
      subjectId: subjectId || record.subjectId,
      classId: classId || record.classId,
    });
    if (existing) {
      return {
        success: false,
        statusCode: 409,
        message: "Đã tồn tại bản ghi với cùng tuần, môn và lớp",
      };
    }

    // ✅ Kiểm tra tổng số tiết trong tuần không vượt quá 17 (khi UPDATE)
    const targetWeekId = weekId || record.weekId;
    const targetPeriods = periods !== undefined ? periods : record.periods;

    const existingPeriodsInWeek = await TeachingRecords.aggregate([
      {
        $match: {
          _id: { $ne: record._id }, // Loại trừ bản ghi đang sửa
          teacherId: teacher._id,
          weekId: targetWeekId,
        },
      },
      {
        $group: {
          _id: null,
          totalPeriods: { $sum: "$periods" },
        },
      },
    ]);

    const currentTotal =
      existingPeriodsInWeek.length > 0
        ? existingPeriodsInWeek[0].totalPeriods
        : 0;
    const newTotal = currentTotal + targetPeriods;

    if (newTotal > 17) {
      const weekInfo = await Week.findById(targetWeekId);
      return {
        success: false,
        statusCode: 400,
        message: `❌ Vượt quá giới hạn 17 tiết/tuần!\n\nTuần ${
          weekInfo?.weekNumber || "?"
        }: Đã có ${currentTotal} tiết (không tính bản ghi này), cập nhật thành ${targetPeriods} tiết sẽ vượt quá giới hạn (tổng: ${newTotal} tiết).\n\nVui lòng nhập tối đa ${
          17 - currentTotal
        } tiết.`,
      };
    }

    console.log(
      `✅ Kiểm tra update: ${currentTotal} + ${targetPeriods} = ${newTotal}/17 tiết`
    );

    // ✅ CẬP NHẬT ĐẦY ĐỦ recordType và notes
    if (teacherId) record.teacherId = teacherId;
    if (weekId) record.weekId = weekId;
    if (subjectId) record.subjectId = subjectId;
    if (classId) record.classId = classId;
    if (periods !== undefined) record.periods = periods;
    if (schoolYearId) record.schoolYearId = schoolYearId;
    if (recordType !== undefined) record.recordType = recordType; // ✅ FIX: Thêm dòng này
    if (notes !== undefined) record.notes = notes; // ✅ FIX: Thêm dòng này

    console.log("🔄 UPDATE - Trước khi save:", {
      id: record._id,
      recordType: record.recordType,
      notes: record.notes,
      periods: record.periods,
    });

    record.updatedAt = new Date();
    await record.save();

    console.log("💾 UPDATE - Sau khi save:", {
      id: record._id,
      recordType: record.recordType,
      notes: record.notes,
      periods: record.periods,
    });

    const populatedRecord = await TeachingRecords.findById(record._id)
      .populate("weekId", "weekNumber startDate endDate schoolYearId")
      .populate("subjectId", "name code")
      .populate("classId", "name grade");

    console.log("✅ UPDATE - Sau populate:", {
      id: populatedRecord._id,
      recordType: populatedRecord.recordType,
      notes: populatedRecord.notes,
    });

    return { success: true, data: populatedRecord };
  } catch (err) {
    return { success: false, message: err.message };
  }
};

const deleteTeachingRecord = async (recordId, currentTeacherId) => {
  try {
    const record = await TeachingRecords.findById(recordId);
    if (!record) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy bản ghi",
      };
    }
    if (currentTeacherId) {
      if (record.teacherId.toString() !== currentTeacherId.toString()) {
        return {
          success: false,
          statusCode: 403,
          message: "Bạn chỉ có thể xóa bản ghi của chính mình",
        };
      }
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
  deleteTeachingRecord,
};
