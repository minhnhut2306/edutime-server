// services/teachingRecordsService.js

const TeachingRecords = require("../models/teachingRecordsModel");
const Teacher = require("../models/teacherModel");
const Week = require("../models/weekModel");
const Subject = require("../models/subjectModel");
const Class = require("../models/classesModel");


/**
 * Lấy danh sách bản ghi theo teacherId
 */
const getTeachingRecordsByTeacher = async (teacherId) => {
  try {
    // Kiểm tra teacher có tồn tại không
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giáo viên",
      };
    }

    // Lấy danh sách teaching records
    const records = await TeachingRecords.find({ teacherId })
      .populate("weekId", "weekNumber startDate endDate schoolYear")
      .populate("subjectId", "name code")
      .populate("classId", "name grade")
      .sort({ createdAt: -1 });

    return {
      success: true,
      data: {
        records,
        total: records.length,
      },
    };
  } catch (error) {
    console.error("Error in getTeachingRecordsByTeacher service:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi lấy danh sách bản ghi",
      error: error.message,
    };
  }
}

/**
 * Tạo bản ghi giảng dạy mới
 */
const createTeachingRecord = async (data) => {
  try {
    const { teacherId, weekId, subjectId, classId, periods, schoolYear, createdBy } = data;

    // Kiểm tra tất cả các tài nguyên song song để tối ưu hiệu suất
    const [teacher, week, subject, classData] = await Promise.all([
      Teacher.findById(teacherId),
      Week.findById(weekId),
      Subject.findById(subjectId),
      Class.findById(classId)
    ]);

    // Kiểm tra teacher có tồn tại
    if (!teacher) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy giáo viên",
      };
    }

    // Kiểm tra week có tồn tại
    if (!week) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy tuần học",
      };
    }

    // Kiểm tra subject có tồn tại
    if (!subject) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy môn học",
      };
    }

    // Kiểm tra class có tồn tại
    if (!classData) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy lớp học",
      };
    }

    // Kiểm tra allowedGrades - teacher có được phép dạy khối này không
    if (
      teacher.allowedGrades &&
      teacher.allowedGrades.length > 0 &&
      !teacher.allowedGrades.includes(classData.grade)
    ) {
      return {
        success: false,
        statusCode: 403,
        message: `Bạn không có quyền dạy khối ${classData.grade}. Chỉ được dạy khối: ${teacher.allowedGrades.join(", ")}`,
      };
    }

    // Kiểm tra trùng lặp (cùng teacher, week, subject, class)
    const existingRecord = await TeachingRecords.findOne({
      teacherId,
      weekId,
      subjectId,
      classId,
    });

    if (existingRecord) {
      return {
        success: false,
        statusCode: 409,
        message: "Bản ghi này đã tồn tại (cùng tuần, môn học và lớp)",
      };
    }

    // Tạo bản ghi mới
    const newRecord = new TeachingRecords({
      teacherId,
      weekId,
      subjectId,
      classId,
      periods,
      schoolYear,
      createdBy,
    });

    await newRecord.save();

    // Populate để trả về đầy đủ thông tin
    const populatedRecord = await TeachingRecords.findById(newRecord._id)
      .populate("weekId", "weekNumber startDate endDate schoolYear")
      .populate("subjectId", "name code")
      .populate("classId", "name grade");

    return {
      success: true,
      data: {
        record: populatedRecord,
      },
    };
  } catch (error) {
    console.error("Error in createTeachingRecord service:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi tạo bản ghi",
      error: error.message,
    };
  }
}

/**
 * Xóa bản ghi (chỉ xóa của mình)
 */
const deleteTeachingRecord = async (recordId, currentUserId) => {
  try {
    // Tìm bản ghi
    const record = await TeachingRecords.findById(recordId);

    if (!record) {
      return {
        success: false,
        statusCode: 404,
        message: "Không tìm thấy bản ghi",
      };
    }

    // Kiểm tra quyền sở hữu - chỉ xóa bản ghi của mình
    if (record.teacherId.toString() !== currentUserId.toString()) {
      return {
        success: false,
        statusCode: 403,
        message: "Bạn chỉ có thể xóa bản ghi của chính mình",
      };
    }

    await TeachingRecords.findByIdAndDelete(recordId);

    return {
      success: true,
      data: {
        deletedId: recordId,
      },
    };
  } catch (error) {
    console.error("Error in deleteTeachingRecord service:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Lỗi khi xóa bản ghi",
      error: error.message,
    };
  }
}


module.exports = {
  getTeachingRecordsByTeacher,
  createTeachingRecord,
  deleteTeachingRecord,
};